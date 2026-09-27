const fs=require("fs"),path=require("path");
// project tool handlers. This module owns only project capability dispatch.
async function handle(registry,n,a){
 if(n==="project_discover")return registry.projectTools.discover(a.root||process.cwd());
 if(n==="project_search")return registry.projectTools.search(a.root||process.cwd(),a.query,a);
 if(n==="project_read_file")return registry.projectTools.read(a.root||process.cwd(),a.filePath,a);
 if(n==="project_write_file")return registry.projectAgent.write(a.root||process.cwd(),a.filePath,a.content);
 if(n==="project_build")return registry.projectAgent.build(a.root||process.cwd(),a.command);
 if(n==="project_test")return registry.projectAgent.test(a.root||process.cwd(),a.command);
 if(n==="project_diagnose")return registry.projectAgent.diagnose(a.root||process.cwd());
 if(n==="git_status")return registry.projectTools.git(a.root||process.cwd(),["status","--short","--branch"]);
 if(n==="git_diff")return registry.projectTools.git(a.root||process.cwd(),["diff",...(a.staged?["--cached"]:[])]);
 if(n==="git_log")return registry.projectTools.git(a.root||process.cwd(),["log","--oneline","--decorate","-n",String(Math.min(100,Math.max(1,Number(a.limit)||20)))]);
 if(n==="git_branches")return registry.projectTools.git(a.root||process.cwd(),["branch","--all","--no-color"]);
 return undefined;
}
module.exports={handle};
