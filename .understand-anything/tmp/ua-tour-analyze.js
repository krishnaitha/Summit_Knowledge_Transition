#!/usr/bin/env node
// Tour analysis script for NexTElevate codebase
const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
  process.exit(1);
}

let graphData;
try {
  graphData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (e) {
  console.error('Failed to read input:', e.message);
  process.exit(1);
}

const { nodes, edges, layers } = graphData;

// Build node map
const nodeMap = {};
for (const node of nodes) {
  nodeMap[node.id] = node;
}

// A. Fan-In Ranking
const fanIn = {};
const fanOut = {};
for (const node of nodes) {
  fanIn[node.id] = 0;
  fanOut[node.id] = 0;
}
for (const edge of edges) {
  if (fanIn[edge.target] !== undefined) fanIn[edge.target]++;
  if (fanOut[edge.source] !== undefined) fanOut[edge.source]++;
}

const fanInRanking = Object.entries(fanIn)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([id, count]) => ({ id, fanIn: count, name: nodeMap[id]?.name || id }));

const fanOutRanking = Object.entries(fanOut)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([id, count]) => ({ id, fanOut: count, name: nodeMap[id]?.name || id }));

// B. Entry Point Candidates
const totalNodes = nodes.length;
const fanInValues = Object.values(fanIn).sort((a, b) => a - b);
const fanOutValues = Object.values(fanOut).sort((a, b) => a - b);
const fanOutTop10Threshold = fanOutValues[Math.floor(totalNodes * 0.9)];
const fanInBottom25Threshold = fanInValues[Math.floor(totalNodes * 0.25)];

const entryPointNames = [
  'index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js',
  'mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py',
  'run.py','__main__.py','Application.java','Main.java','Program.cs','config.ru',
  'index.php','App.swift','Application.kt','main.cpp','main.c'
];

const candidates = [];
for (const node of nodes) {
  let score = 0;

  if (node.type === 'document') {
    if (node.name === 'README.md' && (!node.filePath || node.filePath === 'README.md')) {
      score += 5;
    } else if (node.name && node.name.endsWith('.md') && (!node.filePath || !node.filePath.includes('/'))) {
      score += 2;
    }
  } else if (node.type === 'file') {
    if (entryPointNames.includes(node.name)) score += 3;
    const depth = node.filePath ? node.filePath.split('/').length : 99;
    if (depth <= 2) score += 1;
    if (fanOut[node.id] >= fanOutTop10Threshold) score += 1;
    if (fanIn[node.id] <= fanInBottom25Threshold) score += 1;
  }

  if (score > 0) {
    candidates.push({ id: node.id, score, name: node.name, summary: node.summary || '' });
  }
}

candidates.sort((a, b) => b.score - a.score);
const entryPointCandidates = candidates.slice(0, 5);

// C. BFS Traversal from top code entry point
const codeEntry = candidates.find(c => nodeMap[c.id]?.type === 'file');
const bfsStart = codeEntry ? codeEntry.id : (nodes.find(n => n.type === 'file')?.id);

const bfsOrder = [];
const depthMap = {};
const visited = new Set();

// Build adjacency list for imports/calls edges
const adjList = {};
for (const node of nodes) adjList[node.id] = [];
for (const edge of edges) {
  if (edge.type === 'imports' || edge.type === 'calls') {
    if (adjList[edge.source]) adjList[edge.source].push(edge.target);
  }
}

const queue = [[bfsStart, 0]];
visited.add(bfsStart);
while (queue.length > 0) {
  const [current, depth] = queue.shift();
  bfsOrder.push(current);
  depthMap[current] = depth;
  for (const neighbor of (adjList[current] || [])) {
    if (!visited.has(neighbor)) {
      visited.add(neighbor);
      queue.push([neighbor, depth + 1]);
    }
  }
}

const byDepth = {};
for (const [nodeId, depth] of Object.entries(depthMap)) {
  const key = String(depth);
  if (!byDepth[key]) byDepth[key] = [];
  byDepth[key].push(nodeId);
}

const bfsTraversal = {
  startNode: bfsStart,
  order: bfsOrder,
  depthMap,
  byDepth
};

// D. Non-Code File Inventory
const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
for (const node of nodes) {
  if (node.type === 'document') {
    nonCodeFiles.documentation.push({ id: node.id, name: node.name, summary: node.summary || '' });
  } else if (['service', 'pipeline', 'resource'].includes(node.type)) {
    nonCodeFiles.infrastructure.push({ id: node.id, name: node.name, type: node.type, summary: node.summary || '' });
  } else if (['table', 'schema', 'endpoint'].includes(node.type)) {
    nonCodeFiles.data.push({ id: node.id, name: node.name, type: node.type, summary: node.summary || '' });
  } else if (node.type === 'config') {
    nonCodeFiles.config.push({ id: node.id, name: node.name, summary: node.summary || '' });
  }
}

// E. Tightly Coupled Clusters
const edgeSet = new Set();
const biDirPairs = [];
for (const edge of edges) {
  edgeSet.add(`${edge.source}|${edge.target}`);
}
const seenPairs = new Set();
for (const edge of edges) {
  const reverse = `${edge.target}|${edge.source}`;
  const pairKey = [edge.source, edge.target].sort().join('|');
  if (edgeSet.has(reverse) && !seenPairs.has(pairKey)) {
    seenPairs.add(pairKey);
    biDirPairs.push([edge.source, edge.target]);
  }
}

// Build clusters by expanding bidir pairs
const clusterMap = new Map();
for (const [a, b] of biDirPairs) {
  let found = null;
  for (const [key, cluster] of clusterMap) {
    if (cluster.has(a) || cluster.has(b)) { found = key; break; }
  }
  if (found) {
    clusterMap.get(found).add(a);
    clusterMap.get(found).add(b);
  } else {
    const s = new Set([a, b]);
    clusterMap.set(a + '|' + b, s);
  }
}

// Count edges within each cluster
const clusters = [];
for (const [, clusterSet] of clusterMap) {
  const clusterNodes = Array.from(clusterSet);
  let edgeCount = 0;
  for (const edge of edges) {
    if (clusterSet.has(edge.source) && clusterSet.has(edge.target)) edgeCount++;
  }
  clusters.push({ nodes: clusterNodes, edgeCount });
}
clusters.sort((a, b) => b.edgeCount - a.edgeCount);
const topClusters = clusters.slice(0, 10);

// F. Node Summary Index
const nodeSummaryIndex = {};
for (const node of nodes) {
  nodeSummaryIndex[node.id] = {
    name: node.name,
    type: node.type,
    summary: node.summary || '',
    filePath: node.filePath || '',
    layerId: node.layerId || ''
  };
}

// G. Layers
const layersOutput = {
  count: layers ? layers.length : 0,
  list: layers || []
};

const result = {
  scriptCompleted: true,
  entryPointCandidates,
  fanInRanking,
  fanOutRanking,
  bfsTraversal,
  nonCodeFiles,
  clusters: topClusters,
  layers: layersOutput,
  nodeSummaryIndex,
  totalNodes: nodes.length,
  totalEdges: edges.length
};

try {
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Analysis complete. Nodes: ${nodes.length}, Edges: ${edges.length}`);
  console.log(`BFS from: ${bfsStart}, reached: ${bfsOrder.length} nodes`);
  console.log(`Entry candidates: ${entryPointCandidates.map(c => c.name + '(' + c.score + ')').join(', ')}`);
} catch (e) {
  console.error('Failed to write output:', e.message);
  process.exit(1);
}
