// scheduling tool handlers. This module owns only scheduling capability dispatch.
async function handle(registry,n,a){
 if(n==="schedule_add")return this.scheduler.add(a);
  
 if(n==="schedule_list")return this.scheduler.list();
  
 if(n==="schedule_cancel")return this.scheduler.cancel(a.id);
  
 return undefined;
}
module.exports={handle};
