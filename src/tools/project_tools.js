// project tool handlers. This module owns only project capability dispatch.
async function handle(registry,n,a){
 if(n==="project_discover")return this.projectTools.discover(a.root||process.cwd());
  
 if(n==="project_search")return this.projectTools.search(a.root||process.cwd(),a.query,a);
  
 if(n==="project_read_file")return this.projectTools.read(a.root||process.cwd(),a.filePath,a);
  
 if(n==="project_write_file")return this.projectAgent.write(a.root||process.cwd(),a.filePath,a.content);
  
 if(n==="project_build")return this.projectAgent.build(a.root||process.cwd(),a.command);
  
 if(n==="project_test")return this.projectAgent.test(a.root||process.cwd(),a.command);
  
 if(n==="project_diagnose")return this.projectAgent.diagnose(a.root||process.cwd());
  
 if(n==="git_status")return this.projectTools.git(a.root||process.cwd(),["status","--short","--branch"]);
  
 if(n==="git_diff")return this.projectTools.git(a.root||process.cwd(),["diff",...(a.staged?["--cached"]:[])]);
  
 if(n==="git_log")return this.projectTools.git(a.root||process.cwd(),["log","--oneline","--decorate","-n",String(Math.min(100,Math.max(1,Number(a.limit)||20)))]);
  
 if(n==="git_branches")return this.projectTools.git(a.root||process.cwd(),["branch","--all","--no-color"]);
  
 return undefined;
}
module.exports={handle};
