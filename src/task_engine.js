const crypto=require("crypto");
const fs=require("fs");
const path=require("path");

const SECRET_KEYS=/api[-_]?key|password|token|secret|authorization|cookie|credential/i;
function redact(value,depth=0){
 if(depth>6)return "[redacted-depth]";
 if(value==null)return value;
 if(typeof value==="string")return value.length>20000?value.slice(0,20000)+"…":value;
 if(Array.isArray(value))return value.slice(0,100).map(v=>redact(v,depth+1));
 if(typeof value==="object"){
  const out={};
  for(const [k,v] of Object.entries(value))out[k]=SECRET_KEYS.test(k)?"[redacted]":redact(v,depth+1);
  return out;
 }
 return value;
}

class TaskEngine{
 constructor({onEvent,file,auditFile}={}){this.onEvent=onEvent||(()=>{});this.file=file||null;this.auditFile=auditFile||null;this.tasks=new Map();this.active=null;this.cancelled=new Set();this.load()}
 load(){if(!this.file)return;try{const raw=JSON.parse(fs.readFileSync(this.file,"utf8"));if(Array.isArray(raw)){for(const t of raw){if(t&&t.id)this.tasks.set(t.id,t);}}}catch{}}
 save(){if(!this.file)return;try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(this.list().slice(-100),null,2),"utf8")}catch(e){this.onEvent({type:"persistence_error",error:e.message})}}
 audit(event,data={}){if(!this.auditFile)return;try{fs.mkdirSync(path.dirname(this.auditFile),{recursive:true});let a=[];try{a=JSON.parse(fs.readFileSync(this.auditFile,"utf8"))}catch{};if(!Array.isArray(a))a=[];a.push({time:new Date().toISOString(),event:String(event),data:redact(data)});if(a.length>2000)a=a.slice(-2000);fs.writeFileSync(this.auditFile,JSON.stringify(a,null,2),"utf8")}catch(e){this.onEvent({type:"audit_persistence_error",error:e.message})}}
 create(goal,options={}){const id="task_"+crypto.randomBytes(5).toString("hex");const task={id,goal:String(goal),status:"planning",mode:options.mode==="dry_run"||options.dryRun?"dry_run":"execute",createdAt:new Date().toISOString(),steps:[],attempts:0,failures:0,replans:0,journal:[],cancelRequested:false};this.tasks.set(id,task);this.active=id;this.save();this.audit("task_created",{taskId:id,goal:goal,mode:task.mode});this.emit("task_created",task);return task}
 setPlan(id,steps){const t=this.tasks.get(id);if(!t)return;t.planSteps=(Array.isArray(steps)?steps:[]).map((x,i)=>({id:i+1,title:String(x.title||x),tools:Array.isArray(x.tools)?x.tools:[]}));t.steps=[];t.status="running";this.save();this.audit("plan_created",{taskId:id,steps:t.planSteps});this.emit("task_plan",t);return t}
 startStep(id,index){const t=this.tasks.get(id);if(!t||!t.steps[index]||this.isCancelled(id))return false;t.steps[index].status="running";t.steps[index].startedAt=new Date().toISOString();t.steps[index].attempts++;t.attempts++;this.save();this.audit("step_started",{taskId:id,step:t.steps[index]});this.emit("step_start",{task:t,step:t.steps[index]});return true}
 completeStep(id,index,ok=true,error="",verification=null){const t=this.tasks.get(id);if(!t||!t.steps[index])return;t.steps[index].status=ok?"completed":"failed";t.steps[index].finishedAt=new Date().toISOString();t.steps[index].verification=verification||null;if(!ok){t.failures++;t.steps[index].error=String(error||"Unknown error")}this.save();this.audit("step_result",{taskId:id,step:t.steps[index]});this.emit("step_result",{task:t,step:t.steps[index]})}
 journal(id,entry){const t=this.tasks.get(id);if(!t)return;const safe={at:new Date().toISOString(),tool:String(entry.tool||""),args:redact(entry.args||{}),result:redact(entry.result??null),verification:redact(entry.verification??null),permission:redact(entry.permission??null),recoveryAttempt:Number(entry.recoveryAttempt||0),dryRun:Boolean(entry.dryRun)};t.journal.push(safe);if(t.journal.length>200)t.journal=t.journal.slice(-200);this.save();this.audit("tool_execution",{taskId:id,...safe});this.emit("journal",{task:t,entry:safe})}
 replan(id,steps,reason=""){const t=this.tasks.get(id);if(!t||this.isCancelled(id))return false;t.replans=(Number(t.replans)||0)+1;t.lastRecoveryReason=String(reason||"");t.planSteps=(Array.isArray(steps)?steps:[]).map((x,i)=>({id:i+1,title:String(x.title||x),tools:Array.isArray(x.tools)?x.tools:[]}));this.save();this.audit("task_replanned",{taskId:id,reason,steps:t.planSteps,replans:t.replans});this.emit("task_replanned",t);return true}
 requestCancel(id=this.active){const t=this.tasks.get(id);if(!t)return false;t.cancelRequested=true;this.cancelled.add(id);t.status="cancelling";this.save();this.audit("task_cancel_requested",{taskId:id});this.emit("task_cancel_requested",t);return true}
 isCancelled(id){return this.cancelled.has(id)||Boolean(this.tasks.get(id)?.cancelRequested)}
 finish(id,status="completed",summary=""){const t=this.tasks.get(id);if(!t)return;if(t.cancelRequested)status="cancelled";t.status=status;t.summary=String(summary||"");t.finishedAt=new Date().toISOString();this.save();this.audit("task_finished",{taskId:id,status,summary});this.emit("task_finished",t);if(this.active===id)this.active=null}
 list(){return [...this.tasks.values()].map(t=>JSON.parse(JSON.stringify(t)))}
 get(id=this.active){return id?this.tasks.get(id)||null:null}
 emit(type,data){this.onEvent({type,...data?{task:data.task||data,step:data.step,entry:data.entry}:data})}
}
module.exports={TaskEngine,redact};