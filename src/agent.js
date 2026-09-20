const fs=require("fs"),path=require("path");
class Agent{
 constructor({registry,onEvent}){this.registry=registry;this.onEvent=onEvent;this.file=path.join(require("electron").app.getPath("userData"),"settings.json");this.settings=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file)):({provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.1",apiKey:"",maxSteps:12})}
 set settings(v){this._settings=v;try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(v,null,2))}catch{}}
 get settings(){return this._settings}
 async run(text){
  const s=this.settings;if(!s.apiKey&&s.provider!=="ollama")return "افتح الإعدادات وأدخل API key أو اختر Ollama.";
  const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Solve the user's real goal, use tools, inspect results and continue until done. Never claim success without tool evidence. Ask before destructive, credential, financial, privacy-sensitive or irreversible actions."},{role:"user",content:text}];
  for(let step=0;step<(s.maxSteps||12);step++){
   this.onEvent({type:"thinking",step});const base=s.provider==="ollama"?(s.baseUrl||"http://localhost:11434/v1"):(s.baseUrl||"https://openrouter.ai/api/v1");const headers={"Content-Type":"application/json"};if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;
   const r=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify({model:s.model||"llama3.2",messages,tools:this.registry.schemas(),tool_choice:"auto",temperature:.15})});
   if(!r.ok)throw new Error(await r.text());const m=(await r.json()).choices?.[0]?.message;if(!m)throw new Error("No model response");
   if(!m.tool_calls?.length){this.onEvent({type:"answer",text:m.content||""});return m.content||""}messages.push(m);
   for(const c of m.tool_calls){const a=JSON.parse(c.function.arguments||"{}");this.onEvent({type:"tool",name:c.function.name,args:a});let out;try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)})}
  }return "وصلت إلى الحد الآمن لخطوات التنفيذ قبل اكتمال المهمة.";
 }}
module.exports={Agent};