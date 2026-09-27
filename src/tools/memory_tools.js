// memory tool handlers. This module owns only memory capability dispatch.
async function handle(registry,n,a){
 if(n==="knowledge_index_file")return registry.knowledge.indexFile(a.filePath,{project:a.project||""});
  
 if(n==="knowledge_search")return registry.knowledge.search(a.query,{project:a.project||"",limit:a.limit||10});
  
 if(n==="remember")return registry.memory.add(a.fact,a.tags||[],a.type||"long_term",{project:a.project,taskId:a.taskId});
  
 if(n==="recall")return{ok:true,matches:registry.memory.search(a.query,{type:a.type,project:a.project,limit:a.limit||20})};
  
 return undefined;
}
module.exports={handle};
