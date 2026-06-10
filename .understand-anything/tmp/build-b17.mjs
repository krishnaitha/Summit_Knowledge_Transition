import fs from "fs";
const output = {nodes:[], edges:[]};
output.nodes.push(
  {id:"config:.claude/settings.json",type:"config",name:"settings.json",filePath:".claude/settings.json",summary:"Claude Code project-level settings defining allowed permissions for bash, read, and write operations within the NexTElevate workspace.",tags:["configuration","developer-tooling","security"],complexity:"simple"},
  {id:"document:.github/copilot-instructions.md",type:"document",name:"copilot-instructions.md",filePath:".github/copilot-instructions.md",summary:"GitHub Copilot coding guidelines enforcing strict TypeScript and ESLint rules including no-any policy and type-safety requirements for AI-assisted development.",tags:["documentation","configuration","developer-tooling"],complexity:"simple"},
  {id:"document:.github/pull_request_template.md",type:"document",name:"pull_request_template.md",filePath:".github/pull_request_template.md",summary:"GitHub pull request template with structured sections for summary, changes, type of change, testing notes, and reviewer guidance.",tags:["documentation","developer-tooling","ci-cd"],complexity:"simple"},
  {id:"file:.husky/pre-commit",type:"file",name:"pre-commit",filePath:".husky/pre-commit",summary:"Husky git pre-commit hook that enforces code quality checks before each commit, ensuring linting and formatting standards are met.",tags:["ci-cd","developer-tooling","configuration"],complexity:"simple"},
  {id:"config:.prettierignore",type:"config",name:".prettierignore",filePath:".prettierignore",summary:"Prettier formatter ignore rules excluding generated files and directories from code formatting.",tags:["configuration","build-system","developer-tooling"],complexity:"simple"},
  {id:"config:.understand-anything/.understandignore",type:"config",name:".understandignore",filePath:".understand-anything/.understandignore",summary:"Understand-Anything plugin ignore rules listing paths to exclude from codebase analysis, including generated artifacts and third-party code.",tags:["configuration","developer-tooling"],complexity:"simple"}
);
fs.writeFileSync("C:/Projects/FullSteam/Summit/NextElevate/.understand-anything/tmp/test-batch17.json", JSON.stringify(output,null,2));
console.log("ok");
