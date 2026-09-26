const crypto=require("crypto");

class TaskEngine{
 constructor({onEvent}={}){this.onEvent=onEvent||(()=>{});this.tasks=new Map();this.active=null}
 create(goal){
  const id="task_"+crypto.randomBytes(5).toString("hex");
  const task={id,goal:String(goal),status:"planning",createdAt:new Date().toISOString(),steps:[],attempts:0,failures:0};
  this.tasks.set(id,task);this.active=id;this.emit("task_created",task);return task;
 }
 setPlan(id,steps){
  const t=this.tasks.get(id);if(!t)return;
  t.steps=(Array.isArray(steps)?steps:[]).map((x,i)=>({id:i+1,title:String(x.title||x),status:"pending",attempts:0}));
  t.status="running";this.emit("task_plan",t);return t;
 }
 startStep(id,index){
  const t=this.tasks.get(id);if(!t||!t.steps[index])return;
  t.steps[index].status="running";t.steps[index].startedAt=new Date().toISOString();t.steps[index].attempts++;
  t.attempts++;this.emit("step_start",{task:t,step:t.steps[index]});
 }
 completeStep(id,index,ok=true,error=""){
  const t=this.tasks.get(id);if(!t||!t.steps[index])return;
  t.steps[index].status=ok?"completed":"failed";
  t.steps[index].finishedAt=new Date().toISOString();
  if(!ok){t.failures++;t.steps[index].error=String(error||"Unknown error")}
  this.emit("step_result",{task:t,step:t.steps[index]});
 }
 finish(id,status="completed",summary=""){
  const t=this.tasks.get(id);if(!t)return;
  t.status=status;t.summary=String(summary||"");t.finishedAt=new Date().toISOString();
  this.emit("task_finished",t);if(this.active===id)this.active=null;
 }
 get(id=this.active){return id?this.tasks.get(id)||null:null}
 emit(type,data){this.onEvent({type,...data?{task:data.task||data,step:data.step}:data});}
}
module.exports={TaskEngine};
