#!/usr/bin/env node
'use strict';

const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node ua-arch-analyze.js <input.json> <output.json>');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const { fileNodes, importEdges, allEdges } = input;

// ── A. Common prefix detection ──────────────────────────────────────────────
function commonPrefix(paths) {
  if (!paths.length) return '';
  const parts = paths.map(p => p.replace(/\\/g, '/').split('/'));
  const shortest = Math.min(...parts.map(p => p.length));
  const result = [];
  for (let i = 0; i < shortest - 1; i++) {
    const seg = parts[0][i];
    if (parts.every(p => p[i] === seg)) result.push(seg);
    else break;
  }
  return result.length ? result.join('/') + '/' : '';
}

const allPaths = fileNodes.map(n => (n.filePath || n.name || '').replace(/\\/g, '/'));
const prefix = commonPrefix(allPaths);

function getGroup(filePath) {
  const p = (filePath || '').replace(/\\/g, '/');
  const stripped = prefix ? p.replace(prefix, '') : p;
  const parts = stripped.split('/');
  if (parts.length <= 1) {
    // root-level file — group by pattern or name
    const name = parts[0] || 'root';
    if (/\.(test|spec)\.[^.]+$/.test(name)) return '__tests__';
    if (/\.(config|rc)\.[^.]+$/.test(name) || name.endsWith('.json') || name.endsWith('.toml') || name.endsWith('.yaml') || name.endsWith('.yml')) return 'config';
    return 'root';
  }
  // Handle Next.js route groups: (admin), (member), (auth)
  let seg = parts[0];
  if (seg === 'app') {
    if (parts.length > 1) {
      const sub = parts[1];
      if (sub === '(admin)') return 'app/(admin)';
      if (sub === '(member)') return 'app/(member)';
      if (sub === '(auth)') return 'app/(auth)';
      if (sub === 'api') return 'app/api';
      if (sub === 'actions') return 'app/actions';
      if (sub === 'auth') return 'app/auth';
      return 'app/' + sub;
    }
    return 'app';
  }
  return seg;
}

// ── B. Directory grouping ────────────────────────────────────────────────────
const directoryGroups = {};
for (const node of fileNodes) {
  const group = getGroup(node.filePath || node.name || '');
  if (!directoryGroups[group]) directoryGroups[group] = [];
  directoryGroups[group].push(node.id);
}

// ── C. Node type grouping ────────────────────────────────────────────────────
const nodeTypeGroups = {};
for (const node of fileNodes) {
  const t = node.type || 'file';
  if (!nodeTypeGroups[t]) nodeTypeGroups[t] = [];
  nodeTypeGroups[t].push(node.id);
}

// ── D. Cross-category dependency analysis ───────────────────────────────────
const idToType = {};
for (const node of fileNodes) idToType[node.id] = node.type || 'file';

const crossCategoryMap = {};
for (const edge of allEdges) {
  const fromType = idToType[edge.source];
  const toType = idToType[edge.target];
  if (!fromType || !toType) continue;
  const key = `${fromType}||${toType}||${edge.type}`;
  if (!crossCategoryMap[key]) crossCategoryMap[key] = 0;
  crossCategoryMap[key]++;
}
const crossCategoryEdges = Object.entries(crossCategoryMap).map(([key, count]) => {
  const [fromType, toType, edgeType] = key.split('||');
  return { fromType, toType, edgeType, count };
});

// ── E. Inter-group import frequency ─────────────────────────────────────────
const idToGroup = {};
for (const node of fileNodes) {
  idToGroup[node.id] = getGroup(node.filePath || node.name || '');
}

const interGroupMap = {};
for (const edge of importEdges) {
  const from = idToGroup[edge.source];
  const to = idToGroup[edge.target];
  if (!from || !to || from === to) continue;
  const key = `${from}||${to}`;
  if (!interGroupMap[key]) interGroupMap[key] = 0;
  interGroupMap[key]++;
}
const interGroupImports = Object.entries(interGroupMap).map(([key, count]) => {
  const [from, to] = key.split('||');
  return { from, to, count };
}).sort((a, b) => b.count - a.count);

// ── F. Intra-group density ───────────────────────────────────────────────────
const groupEdgeCounts = {};
for (const edge of importEdges) {
  const from = idToGroup[edge.source];
  const to = idToGroup[edge.target];
  if (!from || !to) continue;
  if (!groupEdgeCounts[from]) groupEdgeCounts[from] = { internalEdges: 0, totalEdges: 0 };
  if (!groupEdgeCounts[to]) groupEdgeCounts[to] = { internalEdges: 0, totalEdges: 0 };
  groupEdgeCounts[from].totalEdges++;
  groupEdgeCounts[to].totalEdges++;
  if (from === to) groupEdgeCounts[from].internalEdges++;
}
const intraGroupDensity = {};
for (const [group, counts] of Object.entries(groupEdgeCounts)) {
  intraGroupDensity[group] = {
    internalEdges: counts.internalEdges,
    totalEdges: counts.totalEdges,
    density: counts.totalEdges > 0 ? +(counts.internalEdges / counts.totalEdges).toFixed(3) : 0
  };
}

// ── G. Directory pattern matching ───────────────────────────────────────────
const patternMap = {
  routes: 'api', api: 'api', controllers: 'api', endpoints: 'api', handlers: 'api',
  serializers: 'api', routers: 'api', blueprints: 'api', controller: 'api',
  services: 'service', core: 'service', lib: 'service', domain: 'service',
  logic: 'service', signals: 'service', composables: 'service', internal: 'service',
  mailers: 'service', jobs: 'service', channels: 'service',
  models: 'data', db: 'data', data: 'data', persistence: 'data',
  repository: 'data', entities: 'data', entity: 'data', migrations: 'data',
  sql: 'data', database: 'data', schema: 'data',
  components: 'ui', views: 'ui', pages: 'ui', ui: 'ui', layouts: 'ui', screens: 'ui',
  middleware: 'middleware', plugins: 'middleware', interceptors: 'middleware', guards: 'middleware',
  utils: 'utility', helpers: 'utility', common: 'utility', shared: 'utility', tools: 'utility',
  pkg: 'utility', templatetags: 'utility',
  config: 'config', constants: 'config', env: 'config', settings: 'config',
  management: 'config', commands: 'config',
  '__tests__': 'test', test: 'test', tests: 'test', spec: 'test', specs: 'test',
  types: 'types', interfaces: 'types', schemas: 'types', contracts: 'types', dtos: 'types',
  dto: 'types', request: 'types', response: 'types',
  hooks: 'hooks',
  store: 'state', state: 'state', reducers: 'state', actions: 'state', slices: 'state',
  assets: 'assets', static: 'assets', public: 'assets',
  bin: 'entry', cmd: 'entry',
  docs: 'documentation', documentation: 'documentation', wiki: 'documentation',
  deploy: 'infrastructure', deployment: 'infrastructure', infra: 'infrastructure',
  infrastructure: 'infrastructure', k8s: 'infrastructure', kubernetes: 'infrastructure',
  helm: 'infrastructure', charts: 'infrastructure', terraform: 'infrastructure',
  tf: 'infrastructure', docker: 'infrastructure',
  '.github': 'ci-cd', '.gitlab': 'ci-cd', '.circleci': 'ci-cd',
};

const patternMatches = {};
for (const group of Object.keys(directoryGroups)) {
  const lower = group.toLowerCase();
  // Check last segment
  const lastSeg = lower.split('/').pop() || lower;
  if (patternMap[lastSeg]) {
    patternMatches[group] = patternMap[lastSeg];
    continue;
  }
  // Check for app route groups
  if (group.startsWith('app/(admin)')) { patternMatches[group] = 'ui'; continue; }
  if (group.startsWith('app/(member)')) { patternMatches[group] = 'ui'; continue; }
  if (group.startsWith('app/(auth)') || group === 'app/auth') { patternMatches[group] = 'ui'; continue; }
  if (group === 'app/api') { patternMatches[group] = 'api'; continue; }
  if (group === 'app/actions') { patternMatches[group] = 'api'; continue; }
  if (group === 'app') { patternMatches[group] = 'ui'; continue; }
  if (group === 'root') { patternMatches[group] = 'config'; continue; }
  patternMatches[group] = 'unknown';
}

// ── H. Deployment topology detection ────────────────────────────────────────
const allNodePaths = fileNodes.map(n => n.filePath || n.name || '');
const infraFiles = [];
const hasDockerfile = allNodePaths.some(p => /^Dockerfile/.test(p));
const hasCompose = allNodePaths.some(p => /docker-compose/.test(p));
const hasK8s = allNodePaths.some(p => /k8s|kubernetes|\.yaml/.test(p));
const hasTerraform = allNodePaths.some(p => /\.tf$|terraform/.test(p));
const hasCI = allNodePaths.some(p => /\.github\/workflows|\.gitlab-ci|Jenkinsfile/.test(p));

for (const p of allNodePaths) {
  if (/^Dockerfile/.test(p) || /docker-compose/.test(p) || /\.github\/workflows/.test(p) || /\.tf$/.test(p) || /Makefile/.test(p)) {
    infraFiles.push(p);
  }
}
const deploymentTopology = { hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI, infraFiles: [...new Set(infraFiles)] };

// ── I. Data pipeline detection ───────────────────────────────────────────────
const schemaFiles = allNodePaths.filter(p => /schema\.sql|\.graphql|\.proto|\.gql/.test(p));
const migrationFiles = allNodePaths.filter(p => /migrations\//.test(p));
const dataModelFiles = allNodePaths.filter(p => /models\/|entities\/|lib\/types/.test(p));
const apiHandlerFiles = allNodePaths.filter(p => /routes\/|api\/.*route\.ts/.test(p));
const dataPipeline = { schemaFiles, migrationFiles, dataModelFiles, apiHandlerFiles };

// ── J. Documentation coverage ────────────────────────────────────────────────
const groupsWithDocs = new Set();
for (const node of fileNodes) {
  if (node.type === 'document' || /\.(md|rst)$/.test(node.filePath || '')) {
    const group = getGroup(node.filePath || node.name || '');
    groupsWithDocs.add(group);
  }
}
const allGroups = Object.keys(directoryGroups);
const undocumentedGroups = allGroups.filter(g => !groupsWithDocs.has(g));
const docCoverage = {
  groupsWithDocs: groupsWithDocs.size,
  totalGroups: allGroups.length,
  coverageRatio: +(groupsWithDocs.size / allGroups.length).toFixed(2),
  undocumentedGroups
};

// ── K. Dependency direction ───────────────────────────────────────────────────
const depDirection = [];
const pairMap = {};
for (const edge of importEdges) {
  const from = idToGroup[edge.source];
  const to = idToGroup[edge.target];
  if (!from || !to || from === to) continue;
  const fwd = `${from}||${to}`;
  const rev = `${to}||${from}`;
  if (!pairMap[fwd]) pairMap[fwd] = 0;
  pairMap[fwd]++;
}
const seen = new Set();
for (const [key, count] of Object.entries(pairMap)) {
  const [from, to] = key.split('||');
  const rev = `${to}||${from}`;
  if (seen.has(rev)) continue;
  seen.add(key);
  const revCount = pairMap[rev] || 0;
  if (count > revCount) depDirection.push({ dependent: from, dependsOn: to });
  else if (revCount > count) depDirection.push({ dependent: to, dependsOn: from });
  else depDirection.push({ dependent: from, dependsOn: to });
}

// ── Fan in/out ────────────────────────────────────────────────────────────────
const fileFanOut = {};
const fileFanIn = {};
for (const edge of importEdges) {
  fileFanOut[edge.source] = (fileFanOut[edge.source] || 0) + 1;
  fileFanIn[edge.target] = (fileFanIn[edge.target] || 0) + 1;
}

// ── File stats ───────────────────────────────────────────────────────────────
const filesPerGroup = {};
for (const [g, ids] of Object.entries(directoryGroups)) filesPerGroup[g] = ids.length;
const nodeTypeCounts = {};
for (const node of fileNodes) {
  const t = node.type || 'file';
  nodeTypeCounts[t] = (nodeTypeCounts[t] || 0) + 1;
}

const output = {
  scriptCompleted: true,
  directoryGroups,
  nodeTypeGroups,
  crossCategoryEdges,
  interGroupImports,
  intraGroupDensity,
  patternMatches,
  deploymentTopology,
  dataPipeline,
  docCoverage,
  dependencyDirection: depDirection,
  fileStats: {
    totalFileNodes: fileNodes.length,
    filesPerGroup,
    nodeTypeCounts
  },
  fileFanIn,
  fileFanOut
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log('Analysis complete. Output written to', outputPath);
