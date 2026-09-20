const fs=require("fs"),path=require("path"),{safeStorage}=require("electron");

class Agent{
 constructor({registry,onEvent}){
  this.registry=registry;this.onEvent=onEvent;this.dir=require("electron").app.getPath("userData");this.file=path.join(this.dir,"settings.json");this.historyFile=path.join(this.dir,"conversation.json");fs.mkdirSync(this.dir,{recursive:true});
  const raw=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,"utf8")):{provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.1",apiKey:"",maxSteps:32};
  this._settings={...raw,apiKey:this.decryptKey(raw.apiKey)};
  this.history=fs.existsSync(this.historyFile)?JSON.parse(fs.readFileSync(this.historyFile,"utf8")):[];
 }
 providerDefaults(name){
  return {
   openrouter:{baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.1"},
   groq:{baseUrl:"https://api.groq.com/openai/v1",model:"llama-3.3-70b-versatile"},
   ollama:{baseUrl:"http://localhost:11434/v1",model:"llama3.2"},
   minimax:{baseUrl:"https://api.minimax.io/v1",model:"MiniMax-M2.5"},
   hermes:{baseUrl:"http://localhost:8000/v1",model:"hermes"}
  }[name]||{};
 }
 encryptKey(key){try{return key&&safeStorage.isEncryptionAvailable()?safeStorage.encryptString(String(key)).toString("base64"):String(key||"")}catch{return String(key||"")}}
 decryptKey(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(v,"base64")):String(v||"")}catch{return String(v||"")}}
 set settings(v){
  this._settings={...this._settings,...v};
  const p=this.providerDefaults(this._settings.provider);if(!this._settings.baseUrl)this._settings.baseUrl=p.baseUrl;if(!this._settings.model)this._settings.model=p.model;
  try{fs.mkdirSync(path.dirname(this.file),{recursive:true});const disk={...this._settings,apiKey:this.encryptKey(this._settings.apiKey)};fs.writeFileSync(this.file,JSON.stringify(disk,null,2))}catch{}
 }
 get settings(){return this._settings}
 saveHistory(){try{fs.writeFileSync(this.historyFile,JSON.stringify(this.history.slice(-200),null,2))}catch{}}
 async run(text){
  const s=this.settings;if(!s.apiKey&&s.provider!=="ollama")return "افتح الإعدادات وأدخل API key أو اختر Ollama.";
  const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Your job is to accomplish the user's actual goal, not merely describe steps. Inspect first when needed, use tools, observe results, verify every important action, recover from failures, and continue until the goal is complete. You can inspect the Windows system, screen, processes, files, web and control mouse/keyboard. Never claim an action succeeded without evidence. Ask before destructive, credential, financial, privacy-sensitive, or irreversible actions. Stay focused on the requested goal."},...this.history.slice(-30),{role:"user",content:text}];
  for(let step=0;step<(Number(s.maxSteps)||32);step++){
   this.onEvent({type:"thinking",step});
   const d=this.providerDefaults(s.provider);const base=(s.baseUrl||d.baseUrl||"http://localhost:11434/v1").replace(/\/$/,"");const headers={"Content-Type":"application/json"};if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;
   const body={model:s.model||d.model||"llama3.2",messages,tools:this.registry.schemas(),tool_choice:"auto",temperature:.1};
   const r=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());const m=(await r.json()).choices?.[0]?.message;if(!m)throw new Error("No model response");
   if(!m.tool_calls?.length){const answer=m.content||"";this.history.push({role:"user",content:text},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer});return answer}
   messages.push(m);
   for(const c of m.tool_calls||[]){
    let a={};try{a=JSON.parse(c.function.arguments||"{}")}catch(e){messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:false,error:"Invalid tool arguments"})});continue}
    this.onEvent({type:"tool",name:c.function.name,args:a});let out;try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}
    if(c.function.name==="screenshot"&&out.ok&&out.image){
     messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:true,description:"Screenshot captured."})});
     messages.push({role:"user",content:[{type:"text",text:"Inspect this current screen image and continue the task."},{type:"image_url",image_url:{url:out.image}}]});
    }else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)});
   }
  }
  const answer="توقفت دورة التنفيذ عند الحد الآمن للخطوات. يمكن متابعة المهمة دون فقدان الذاكرة.";this.history.push({role:"user",content:text},{role:"assistant",content:answer});this.saveHistory();return answer;
 }
}
module.exports={Agent};