const fs=require("fs"),path=require("path");
class Agent{
 constructor({registry,onEvent}){this.registry=registry;this.onEvent=onEvent;this.dir=path.join(require("electron").app.getPath("userData"));this.file=path.join(this.dir,"settings.json");this.historyFile=path.join(this.dir,"conversation.json");fs.mkdirSync(this.dir,{recursive:true});this.settings=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file)):({provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.1",apiKey:"",maxSteps:16});this.history=fs.existsSync(this.historyFile)?JSON.parse(fs.readFileSync(this.historyFile)):[]}
 set settings(v){this._settings=v;try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(v,null,2))}catch{}}
 get settings(){return this._settings}
 saveHistory(){try{fs.writeFileSync(this.historyFile,JSON.stringify(this.history.slice(-100),null,2))}catch{}}
 async run(text){
  const s=this.settings;if(!s.apiKey&&s.provider!=="ollama")return "افتح الإعدادات وأدخل API key أو اختر Ollama.";
  const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Solve the user's real goal, not just chat. Inspect the computer when needed, use tools, observe results, verify actions, recover from failures and continue until the goal is complete. You can control mouse and keyboard and inspect screenshots. Never claim success without evidence. Ask before destructive, credential, financial, privacy-sensitive or irreversible actions. Respect the user's instructions and do not perform unrelated actions."},...this.history.slice(-20),{role:"user",content:text}];
  for(let step=0;step<(s.maxSteps||16);step++){
   this.onEvent({type:"thinking",step});const base=s.provider==="ollama"?(s.baseUrl||"http://localhost:11434/v1"):(s.baseUrl||"https://openrouter.ai/api/v1");const headers={"Content-Type":"application/json"};if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;
   const r=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify({model:s.model||"llama3.2",messages,tools:this.registry.schemas(),tool_choice:"auto",temperature:.12})});
   if(!r.ok)throw new Error(await r.text());const m=(await r.json()).choices?.[0]?.message;if(!m)throw new Error("No model response");
   if(!m.tool_calls?.length){const answer=m.content||"";this.history.push({role:"user",content:text},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer});return answer}
   messages.push(m);
   for(const c of m.tool_calls){const a=JSON.parse(c.function.arguments||"{}");this.onEvent({type:"tool",name:c.function.name,args:a});let out;try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}
    if(c.function.name==="screenshot"&&out.ok&&out.image){messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:true,description:"Screenshot captured; visual image follows."})});messages.push({role:"user",content:[{type:"text",text:"Here is the current screen. Inspect it visually and continue the task."},{type:"image_url",image_url:{url:out.image}}]})}
    else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)});
   }
  }
  const answer="وصلت إلى الحد الآمن لخطوات التنفيذ قبل اكتمال المهمة.";this.history.push({role:"user",content:text},{role:"assistant",content:answer});this.saveHistory();return answer;
 }
}
module.exports={Agent};