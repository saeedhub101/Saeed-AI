// filesystem tool handlers. This module owns only filesystem capability dispatch.
async function handle(registry,n,a){
 if(n==="list_directory")return{ok:true,files:fs.readdirSync(path.resolve(a.directory||"."),{withFileTypes:true}).map(x=>({name:x.name,directory:x.isDirectory()}))};
  
 if(n==="read_file")return{ok:true,content:fs.readFileSync(path.resolve(a.filePath),"utf8").slice(0,200000)};
  
 if(n==="write_file"){const p=path.resolve(a.filePath);const rollback=registry.createRollbackSnapshot(p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,String(a.content),"utf8");return{ok:true,path:p,bytes:Buffer.byteLength(String(a.content)),rollbackId:rollback?.id||null};};
  
 if(n==="add_task"){const t={id:Date.now().toString(),title:String(a.title),done:false,created:new Date().toISOString()};registry.tasks.push(t);registry.saveTasks();return{ok:true,task:t}};
  
 if(n==="list_tasks")return{ok:true,tasks:registry.tasks};
  
 if(n==="complete_task"){const t=registry.tasks.find(x=>x.id===a.id);if(!t)return{ok:false,error:"Task not found"};t.done=true;t.completed=new Date().toISOString();registry.saveTasks();return{ok:true,task:t}};
  
 if(n==="remove_task"){const before=registry.tasks.length;registry.tasks=registry.tasks.filter(x=>x.id!==a.id);registry.saveTasks();return{ok:registry.tasks.length!==before}};
  
 if(n==="reveal_file"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"File not found"};shell.showItemInFolder(p);return{ok:true,path:p}}
  
 if(n==="rollback")return registry.rollback(a.id);
  
 if(n==="copy_file"){const s=path.resolve(a.source),d=path.resolve(a.destination);if(!fs.existsSync(s))return{ok:false,error:"Source not found"};const rollback=registry.createRollbackSnapshot(d);fs.cpSync(s,d,{recursive:true});return{ok:fs.existsSync(d),source:s,destination:d,rollbackId:rollback?.id||null}};
  
 if(n==="move_file"){const s=path.resolve(a.source),d=path.resolve(a.destination);if(!fs.existsSync(s))return{ok:false,error:"Source not found"};const rollback=registry.createRollbackSnapshot(d);fs.mkdirSync(path.dirname(d),{recursive:true});fs.renameSync(s,d);return{ok:fs.existsSync(d),source:s,destination:d,rollbackId:rollback?.id||null}};
  
 if(n==="delete_file"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"Path not found"};fs.rmSync(p,{recursive:Boolean(a.recursive),force:false});return{ok:!fs.existsSync(p),path:p}};
  
 if(n==="create_directory"){const p=path.resolve(a.directory);fs.mkdirSync(p,{recursive:true});return{ok:true,path:p}};
  
 return undefined;
}
module.exports={handle};
