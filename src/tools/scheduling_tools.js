// scheduling tool handlers. This module owns only scheduling capability dispatch.
async function handle(registry,n,a){
 if(n==="schedule_add")return registry.scheduler.add(a);
  
 if(n==="schedule_list")return registry.scheduler.list();
  
 if(n==="schedule_cancel")return registry.scheduler.cancel(a.id);
  
 return undefined;
}
module.exports={handle};
