const fs=require("fs"),path=require("path"),{safeStorage,app}=require("electron");

class Agent{
 constructor({registry,onEvent}){
  this.registry=registry;this.onEvent=onEvent;this.dir=app.getPath("userData");
  this.file=path.join(this.dir,"settings.json");this.historyFile=path.join(this.dir,"conversation.json");
  fs.mkdirSync(this.dir,{recursive:true});
  const raw=this.readJson(this.file,{provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.1",apiKey:"",maxSteps:32});
  this._settings={...raw,apiKey:this.decryptKey(raw.apiKey)};
  this.history=this.readJson(this.historyFile,[]);
  if(!Array.isArray(this.history))this.history=[];
 }
 readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
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
 publicSettings(){return{...this._settings,apiKey:"",hasApiKey:Boolean(this._settings.apiKey)}}
 set settings(v){
  const previous=this._settings||{},input=v||{},providerChanged=input.provider&&input.provider!==previous.provider;
  this._settings={...previous,...input};
  if(input.apiKey==="")this._settings.apiKey=previous.apiKey||"";
  const p=this.providerDefaults(this._settings.provider);
  if(providerChanged){
   if(input.baseUrl===undefined||input.baseUrl===previous.baseUrl)this._settings.baseUrl=p.baseUrl;
   if(input.model===undefined||input.model===previous.model)this._settings.model=p.model;
  }
  if(!this._settings.baseUrl)this._settings.baseUrl=p.baseUrl;
  if(!this._settings.model)this._settings.model=p.model;
  this.persistSettings();
 }
 get settings(){return this._settings}
 persistSettings(){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({...this._settings,apiKey:this.encryptKey(this._settings.apiKey)},null,2))}catch(e){console.error("Settings save failed:",e)}}
 saveHistory(){try{fs.writeFileSync(this.historyFile,JSON.stringify(this.history.slice(-200),null,2))}catch(e){console.error("History save failed:",e)}}
 async run(text,image=null){
  const s=this.settings;if(!String(text).trim())return "اكتب لي المهمة التي تريد تنفيذها.";
  if(!s.apiKey&&s.provider!=="ollama")return "افتح الإعدادات وأدخل API key أو اختر Ollama.";
  const userContent=image?[{type:"text",text:String(text)},{type:"image_url",image_url:{url:image}}]:String(text);
  const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Accomplish the user's actual goal, inspect first when needed, use tools, observe results, verify important actions, recover from failures, and continue until the goal is complete. You can inspect Windows, screen, processes, files and web, and control mouse/keyboard. Never claim success without evidence. Ask before destructive, credential, financial, privacy-sensitive, or irreversible actions. Stay focused."},...this.history.slice(-30),{role:"user",content:userContent}];
  for(let step=0;step<(Math.min(100,Math.max(1,Number(s.maxSteps)||32)));step++){
   this.onEvent({type:"thinking",step});
   const d=this.providerDefaults(s.provider),base=(s.baseUrl||d.baseUrl||"http://localhost:11434/v1").replace(/\/$/,"");
   const headers={"Content-Type":"application/json"};if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;
   const body={model:s.model||d.model||"llama3.2",messages,tools:this.registry.schemas(),tool_choice:"auto",temperature:.1};
   let r;
   try{r=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify(body)})}
   catch(e){throw new Error("تعذر الاتصال بمزود الذكاء الاصطناعي: "+e.message)}
   if(!r.ok)throw new Error(await r.text());
   const m=(await r.json()).choices?.[0]?.message;if(!m)throw new Error("No model response");
   if(!m.tool_calls?.length){
    const answer=m.content||"";
    this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer});return answer;
   }
   messages.push(m);
   for(const c of m.tool_calls||[]){
    let a={};try{a=JSON.parse(c.function.arguments||"{}")}catch{messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:false,error:"Invalid tool arguments"})});continue}
    this.onEvent({type:"tool",name:c.function.name,args:a});
    let out;try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}};
    if(c.function.name==="screenshot"&&out.ok&&out.image){
     messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:true,description:"Screenshot captured."})});
     messages.push({role:"user",content:[{type:"text",text:"Inspect this current screen image and continue the task."},{type:"image_url",image_url:{url:out.image}}]});
    }else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)});
   }
  }
  const answer="توقفت دورة التنفيذ عند الحد الآمن للخطوات. يمكن متابعة المهمة دون فقدان الذاكرة.";
  this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();return answer;
 }
}
module.exports={Agent};