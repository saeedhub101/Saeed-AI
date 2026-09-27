// memory tool handlers. Execution ownership stays in ToolRegistry; this module only groups related tools.
async function handle(registry,n,a){
 if(n==="knowledge_index_file")return this.knowledge.indexFile(a.filePath,{project:a.project||""});
  if(n==="knowledge_search")return this.knowledge.search(a.query,{project:a.project||"",limit:a.limit||10});
  if(n==="schedule_add")return this.scheduler.add(a);
  if(n==="schedule_list")return this.scheduler.list();
  if(n==="schedule_cancel")return this.scheduler.cancel(a.id);
  if(n==="system_info")return{ok:true,platform:process.platform,release:os.release(),arch:process.arch,cpu:os.cpus().length,totalMemory:os.totalmem(),freeMemory:os.freemem(),uptime:os.uptime()}
 return undefined;
}
module.exports={handle};
