const fs=require("fs"),path=require("path");
class Agent{
 constructor({registry,onEvent}){this.registry=registry;this.onEvent=onEvent;this.file=path.join(require("electron").app.getPath("userData"),"settings.json");this.settings=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file)):({provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.1",apiKey:""});}
 set settings(v){this._settings=v;try{fs.writeFileSync(this.file,JSON.stringify(v,null,2))}catch{}}
 get settings(){return this._settings}
 async run(text){
  this.onEvent({type:"thinking"});
  const s=this.settings;if(!s.apiKey&&s.provider!=="ollama")return "أدخل API key من الإعدادات أولاً.";
  const messages=[{role:"system",content:"You are Saeed, a desktop AI agent. Plan tasks, use tools, inspect results, verify actions and never claim an action happened unless a tool succeeded. Ask before destructive or sensitive actions."},{role:"user",content:text}];
  for(let i=0;i<8;i++){
   const r=await fetch((s.baseUrl||"https://openrouter.ai/api/v1")+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",...(s.apiKey?{Authorization:"Bearer "+s.apiKey}:{})},body:JSON.stringify({model:s.model||"llama3.2",messages,tools:this.registry.schemas(),temperature:.2})});
   if(!r.ok)throw new Error(await r.text());
   const m=(await r.json()).choices[0].message;
   if(!m.tool_calls){this.onEvent({type:"answer",text:m.content||""});return m.content||""}
   messages.push(m);
   for(const c of m.tool_calls){let out;try{out=await this.registry.call(c.function.name,JSON.parse(c.function.arguments||"{}"))}catch(e){out={ok:false,error:e.message}}messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)})}
  }
  return "توقفت بعد الحد الآمن لعدد خطوات التنفيذ.";
 }
}
module.exports={Agent};