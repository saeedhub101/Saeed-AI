const os=require("os");
const fs=require("fs");
const path=require("path");
const smokeMark=label=>{if(process.env.SAEED_SMOKE_TEST==="1"){try{fs.appendFileSync(path.join(process.cwd(),"smoke-entry.marker"),"tools:"+label+"\\n")}catch{}}};
const {Computer}=require("./computer");smokeMark("computer");
const {Memory}=require("./memory");smokeMark("memory");
const {OfficeTools}=require("./office");smokeMark("office");
const {shell}=require("electron");smokeMark("electron");
const {PermissionEngine}=require("./permissions");smokeMark("permissions");
const {VerificationEngine}=require("./verification_engine");smokeMark("verification");
const {PumpCatalog}=require("./pump_catalog");smokeMark("pump-catalog");
const {ApplicationAdapter}=require("./application_adapter");smokeMark("application-adapter");
let DatabaseAdapter;
const {PumpSchemaMapper}=require("./pump_schema_mapper");smokeMark("pump-schema");
const {PumpImportPlanner}=require("./pump_import_planner");smokeMark("pump-import");
const {ApplicationUIMapper}=require("./application_ui_mapper");smokeMark("ui-mapper");
const {VisionEngine}=require("./vision_engine");smokeMark("vision");
const {ProjectAgent}=require("./project_agent");smokeMark("project-agent");
const {KnowledgeStore}=require("./knowledge");smokeMark("knowledge");
const {Scheduler}=require("./scheduler");smokeMark("scheduler");
const PROJECT_IGNORE=new Set([".git","node_modules","dist","build","out","release","releases","coverage",".cache"]);
function projectWalk(root,{maxDepth=7,maxFiles=5000}={}){
 const out=[]; const base=path.resolve(root);
 function visit(dir,depth){
  if(depth>maxDepth||out.length>=maxFiles)return;
  let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
  for(const e of entries){
   if(out.length>=maxFiles)break;
   if(e.name.startsWith(".")&&e.name!==".env.example")continue;
   const p=path.join(dir,e.name);
   if(e.isDirectory()){if(!PROJECT_IGNORE.has(e.name))visit(p,depth+1)}else out.push(p);
  }
 }
 visit(base,0);return out;
}
class ProjectTools{
 discover(root){
  const base=path.resolve(root||process.cwd()),files=projectWalk(base,{maxDepth:5,maxFiles:3000});
  const manifests=files.filter(f=>["package.json","Cargo.toml","pyproject.toml","requirements.txt","CMakeLists.txt"].includes(path.basename(f))||/\.(sln|csproj|vcxproj)$/i.test(f));
  return{ok:true,root:base,git:fs.existsSync(path.join(base,".git")),fileCount:files.length,manifests:manifests.map(f=>path.relative(base,f)),files:files.slice(0,500).map(f=>path.relative(base,f))};
 }
 search(root,query,options={}){
  const base=path.resolve(root||process.cwd()),q=String(query||"").toLowerCase(),max=Math.min(200,Math.max(1,Number(options.maxResults)||100));
  if(!q)return{ok:false,error:"query is required"}; const ext=Array.isArray(options.extensions)?new Set(options.extensions.map(x=>String(x).replace(/^\./,"").toLowerCase())):null; const results=[];
  for(const f of projectWalk(base,{maxDepth:8,maxFiles:5000})){if(results.length>=max)break;if(ext&&!ext.has(path.extname(f).slice(1).toLowerCase()))continue;let s;try{if(fs.statSync(f).size>2000000)continue;s=fs.readFileSync(f,"utf8")}catch{continue}
   s.split(/\r?\n/).forEach((line,i)=>{if(results.length<max&&line.toLowerCase().includes(q))results.push({file:path.relative(base,f),line:i+1,text:line.slice(0,1000)})});
  } return{ok:true,query:String(query),count:results.length,results};
 }
 read(root,filePath,options={}){
  const base=path.resolve(root||process.cwd()),p=path.resolve(base,filePath);
  if(p!==base&&!p.startsWith(base+path.sep))return{ok:false,error:"Path escapes project root."};
  if(!fs.existsSync(p)||!fs.statSync(p).isFile())return{ok:false,error:"File not found."};
  const lines=fs.readFileSync(p,"utf8").split(/\r?\n/),start=Math.max(1,Number(options.startLine)||1),end=Math.min(lines.length,Math.max(start,Number(options.endLine)||start+249));
  return{ok:true,file:path.relative(base,p),startLine:start,endLine:end,totalLines:lines.length,content:lines.slice(start-1,end).map((x,i)=>String(start+i).padStart(5," ")+" | "+x).join("\\n")};
 }
 git(root,args){const cp=require("child_process"),r=cp.spawnSync("git",args,{cwd:path.resolve(root||process.cwd()),encoding:"utf8",timeout:15000,windowsHide:true});return{ok:r.status===0,exitCode:r.status,stdout:String(r.stdout||"").slice(0,20000),stderr:String(r.stderr||"").slice(0,10000)}}
}


class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm}){this.computer=new Computer();this.office=new OfficeTools();this.captureScreen=captureScreen;this.confirm=confirm|| (async()=>false);this.userDataPath=userDataPath||process.cwd();this.permissionFile=path.join(this.userDataPath,"permissions.json");const saved=this.loadPermissions();this.permissions=new PermissionEngine({confirm:this.confirm,policy:saved});this.verifier=new VerificationEngine({computer:this.computer});this.pumpCatalog=new PumpCatalog();this.appAdapter=new ApplicationAdapter(this.computer);({DatabaseAdapter}=require("./database_adapter"));this.dbAdapter=new DatabaseAdapter(this.computer);this.pumpSchemaMapper=new PumpSchemaMapper();this.pumpImportPlanner=new PumpImportPlanner();this.appUIMapper=new ApplicationUIMapper();this.projectTools=new ProjectTools();this.vision=new VisionEngine({captureScreen:this.captureScreen,computer:this.computer,userDataPath:this.userDataPath});this.projectAgent=new ProjectAgent({tools:this.projectTools});this.memory=new Memory();this.knowledge=new KnowledgeStore({file:path.join(this.userDataPath,"knowledge.json")});this.scheduler=new Scheduler({file:path.join(this.userDataPath,"scheduler.json")});const {EmailService}=require("./email_service");this.email=new EmailService({getConfig:()=>this.emailConfig()});this.taskFile=path.join(this.userDataPath,"tasks.json");this.rollbackRoot=path.join(this.userDataPath,"rollback");fs.mkdirSync(this.rollbackRoot,{recursive:true});this.tasks=this.loadTasks()}
 loadTasks(){try{return JSON.parse(fs.readFileSync(this.taskFile,"utf8"))}catch{return[]}}
 loadPermissions(){try{return JSON.parse(fs.readFileSync(this.permissionFile,"utf8"))}catch{return null}}
 setPermissionPolicy(policy){const p=this.permissions.setPolicy(policy||{});try{fs.mkdirSync(this.userDataPath,{recursive:true});fs.writeFileSync(this.permissionFile,JSON.stringify(p,null,2),"utf8")}catch(e){console.error("Permissions save failed:",e)}return p}
 getPermissionPolicy(){return this.permissions.getPolicy()}
 emailConfig(){return this.emailSettings||{}}
 setEmailSettings(settings={}){this.emailSettings={...(this.emailSettings||{}),...(settings||{})};return this.emailSettings}
 getEmailSettings(){return {...(this.emailSettings||{}),password:"",hasPassword:Boolean(this.emailSettings?.password)}}
 permissionCategories(){return this.permissions.getCategories()}
 saveTasks(){fs.mkdirSync(this.userDataPath,{recursive:true});fs.writeFileSync(this.taskFile,JSON.stringify(this.tasks,null,2),"utf8")}
 createRollbackSnapshot(target){
  const p=path.resolve(String(target||"")); if(!p)return null;
  const id="rb_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),dir=path.join(this.rollbackRoot,id),backup=path.join(dir,"data");
  fs.mkdirSync(dir,{recursive:true});
  const existed=fs.existsSync(p); if(existed)fs.cpSync(p,backup,{recursive:true});
  const meta={id,target:p,createdAt:new Date().toISOString(),existed,wasDirectory:existed?fs.statSync(p).isDirectory():false};
  fs.writeFileSync(path.join(dir,"meta.json"),JSON.stringify(meta,null,2),"utf8");return meta;
 }
 rollback(id){
  const safe=String(id||"").replace(/[^a-zA-Z0-9_-]/g,""),dir=path.join(this.rollbackRoot,safe),metaPath=path.join(dir,"meta.json"),backup=path.join(dir,"data");
  if(!fs.existsSync(metaPath))return{ok:false,error:"Rollback snapshot not found."};
  const meta=JSON.parse(fs.readFileSync(metaPath,"utf8")),target=path.resolve(meta.target);
  if(!target)return{ok:false,error:"Rollback target is invalid."};
  if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:false});
  if(meta.existed){if(!fs.existsSync(backup))return{ok:false,error:"Rollback backup data is missing."};fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(backup,target,{recursive:true});}
  return{ok:meta.existed?!fs.existsSync(target):!fs.existsSync(target),rollbackId:safe,target,restored:meta.existed};
 }
 schemas(){if(!getToolSchemas)({getToolSchemas,dispatchToolCall}=require("./tools/dispatcher"));return getToolSchemas();}
 async call(n,a){if(!dispatchToolCall)({getToolSchemas,dispatchToolCall}=require("./tools/dispatcher"));return dispatchToolCall(this,n,a);}
}
module.exports={ToolRegistry};