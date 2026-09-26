const fs=require("fs"),path=require("path"),crypto=require("crypto");

class Scheduler{
 constructor({file,onDue}={}){this.file=file||path.join(process.cwd(),"scheduler.json");this.onDue=onDue||null;this.items=this.load()}
 load(){try{const x=JSON.parse(fs.readFileSync(this.file,"utf8"));return Array.isArray(x)?x:[]}catch{return[]}}
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+".tmp";fs.writeFileSync(tmp,JSON.stringify(this.items,null,2),"utf8");fs.renameSync(tmp,this.file)}
 add(input={}){
  const prompt=String(input.prompt||"").trim();if(!prompt)return{ok:false,error:"prompt is required"};
  const d=new Date(input.runAt);if(!Number.isFinite(d.getTime()))return{ok:false,error:"runAt must be a valid date/time"};
  const interval=input.intervalMs==null?null:Number(input.intervalMs);
  if(interval!==null&&(!Number.isFinite(interval)||interval<1000))return{ok:false,error:"intervalMs must be at least 1000 milliseconds"};
  const mode=input.mode==="dry_run"?"dry_run":"execute";
  const item={id:crypto.randomUUID(),title:String(input.title||prompt.slice(0,80)),prompt,runAt:d.toISOString(),intervalMs:interval,mode,enabled:true,running:false,lastRunAt:null,lastResult:null,createdAt:new Date().toISOString()};
  this.items.push(item);this.save();return{ok:true,item};
 }
 list(){return{ok:true,tasks:this.items.map(x=>({...x}))}}
 cancel(id){const item=this.items.find(x=>x.id===String(id));if(!item)return{ok:false,error:"Scheduled task not found"};item.enabled=false;item.cancelledAt=new Date().toISOString();this.save();return{ok:true,item}}
 async tick(now=new Date()){
  const current=now instanceof Date?now:new Date(now);if(!Number.isFinite(current.getTime()))return{ok:false,error:"Invalid scheduler time"};
  const due=this.items.filter(x=>x.enabled&&!x.running&&new Date(x.runAt).getTime()<=current.getTime());
  const results=[];
  for(const item of due){
   item.running=true;item.lastRunAt=current.toISOString();this.save();
   try{
    const result=await this.onDue?.({...item});
    item.lastResult={ok:result?.ok!==false,result:result?.result??result,message:result?.message||null};
    if(item.intervalMs&&item.intervalMs>=1000){item.runAt=new Date(current.getTime()+item.intervalMs).toISOString();item.enabled=true}
    else item.enabled=false;
    results.push({id:item.id,ok:item.lastResult.ok});
   }catch(e){
    item.lastResult={ok:false,error:e.message};
    if(item.intervalMs&&item.intervalMs>=1000){item.runAt=new Date(current.getTime()+item.intervalMs).toISOString();item.enabled=true}
    else item.enabled=false;
    results.push({id:item.id,ok:false,error:e.message});
   }finally{item.running=false;this.save()}
  }
  return{ok:true,count:results.length,results};
 }
}
module.exports={Scheduler};
