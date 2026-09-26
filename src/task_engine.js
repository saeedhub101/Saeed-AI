const crypto=require("crypto");

class TaskEngine{
 constructor({onEvent}={}){this.onEvent=onEvent||(()=>{});this.tasks=new Map();this.active=null;this.cancelled=new Set()}
 create(goal,options={}){
  const id="task_"+crypto.randomBytes(5).toString("hex");
  const task={id,goal:String(goal),status:"planning",mode:options.mode==="dry_run"||options.dryRun?"dry_run":"execute",createdAt:new Date().toISOString(),steps:[],attempts:0,failures:0,journal:[],cancelRequested:false};
  this.tasks.set(id,task);this.active=id;this.emit("task_created",task);return task;
 }
 setPlan(id,steps){
  const t=this.tasks.get(id);if(!t)return;
  t.steps=(Array.isArray(steps)?steps:[]).map((x,i)=>({id:i+1,title:String(x.title||x),status:"pending",attempts:0,verification:null}));
  t.status="running";this.emit("task_plan",t);return t;
 }
 startStep(id,index){
  const t=this.tasks.get(id);if(!t||!t.steps[index]||this.isCancelled(id))return false;
  t.steps[index].status="running";t.steps[index].startedAt=new Date().toISOString();t.steps[index].attempts++;
  t.attempts++;this.emit("step_start",{task:t,step:t.steps[index]});return true;
 }
 completeStep(id,index,ok=true,error="",verification=null){
  const t=this.tasks.get(id);if(!t||!t.steps[index])return;
  t.steps[index].status=ok?"completed":"failed";t.steps[index].finishedAt=new Date().toISOString();t.steps[index].verification=verification||null;
  if(!ok){t.failures++;t.steps[index].error=String(error||"Unknown error")}
  this.emit("step_result",{task:t,step:t.steps[index]});
 }
 journal(id,entry){
  const t=this.tasks.get(id);if(!t)return;
  const safe={at:new Date().toISOString(),tool:String(entry.tool||""),args:entry.args||{},result:entry.result??null,verification:entry.verification??null,permission:entry.permission??null};
  t.journal.push(safe);if(t.journal.length>200)t.journal=t.journal.slice(-200);this.emit("journal",{task:t,entry:safe});
 }
 requestCancel(id=this.active){
  const t=this.tasks.get(id);if(!t)return false;
  t.cancelRequested=true;this.cancelled.add(id);t.status="cancelling";this.emit("task_cancel_requested",t);return true;
 }
 isCancelled(id){return this.cancelled.has(id)||Boolean(this.tasks.get(id)?.cancelRequested)}
 finish(id,status="completed",summary=""){
  const t=this.tasks.get(id);if(!t)return;
  if(t.cancelRequested)status="cancelled";
  t.status=status;t.summary=String(summary||"");t.finishedAt=new Date().toISOString();
  this.emit("task_finished",t);if(this.active===id)this.active=null;
 }
 list(){return [...this.tasks.values()].map(t=>JSON.parse(JSON.stringify(t)))}
 get(id=this.active){return id?this.tasks.get(id)||null:null}
 emit(type,data){this.onEvent({type,...data?{task:data.task||data,step:data.step,entry:data.entry}:data});}
}
module.exports={TaskEngine};
