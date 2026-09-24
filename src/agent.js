const fs=require("fs"),path=require("path"),{safeStorage,app}=require("electron");

class Agent{
 constructor({registry,onEvent}){
  this.registry=registry;this.onEvent=onEvent;this.dir=app.getPath("userData");this.file=path.join(this.dir,"settings.json");this.historyFile=path.join(this.dir,"conversation.json");fs.mkdirSync(this.dir,{recursive:true});
  const raw=this.readJson(this.file,{provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.6-luna",apiKey:"",maxSteps:32});
  this._settings={...raw,apiKey:this.decryptKey(raw.apiKey)};this.history=this.readJson(this.historyFile,[]);if(!Array.isArray(this.history))this.history=[];
 }
 readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
 providerCatalog(){return [
  {id:"openai",name:"OpenAI",baseUrl:"https://api.openai.com/v1",model:"gpt-5.6-luna",keyUrl:"https://platform.openai.com/api-keys"},
  {id:"anthropic",name:"Claude (via OpenRouter)",baseUrl:"https://openrouter.ai/api/v1",model:"anthropic/claude-sonnet-4-6",keyUrl:"https://openrouter.ai/keys"},
  {id:"gemini",name:"Google Gemini",baseUrl:"https://generativelanguage.googleapis.com/v1beta/openai/",model:"gemini-3.8-flash",keyUrl:"https://aistudio.google.com/app/apikey"},
  {id:"xai",name:"Grok / xAI",baseUrl:"https://api.x.ai/v1",model:"grok-4.7",keyUrl:"https://console.x.ai"},
  {id:"groq",name:"Groq",baseUrl:"https://api.groq.com/openai/v1",model:"openai/gpt-oss-120b",keyUrl:"https://console.groq.com/keys"},
  {id:"mistral",name:"Mistral",baseUrl:"https://api.mistral.ai/v1",model:"mistral-large-latest",keyUrl:"https://console.mistral.ai/api-keys"},
  {id:"deepseek",name:"DeepSeek",baseUrl:"https://api.deepseek.com/v1",model:"deepseek-chat",keyUrl:"https://platform.deepseek.com/api_keys"},
  {id:"openrouter",name:"OpenRouter",baseUrl:"https://openrouter.ai/api/v1",model:"openai/gpt-5.6-luna",keyUrl:"https://openrouter.ai/keys"},
  {id:"together",name:"Together AI",baseUrl:"https://api.together.xyz/v1",model:"meta-llama/Llama-3.3-70B-Instruct-Turbo",keyUrl:"https://api.together.ai/settings/api-keys"},
  {id:"fireworks",name:"Fireworks AI",baseUrl:"https://api.fireworks.ai/inference/v1",model:"accounts/fireworks/models/llama-v3p1-70b-instruct",keyUrl:"https://fireworks.ai/account/api-keys"},
  {id:"cerebras",name:"Cerebras",baseUrl:"https://api.cerebras.ai/v1",model:"llama-3.3-70b",keyUrl:"https://cloud.cerebras.ai"},
  {id:"perplexity",name:"Perplexity",baseUrl:"https://api.perplexity.ai",model:"sonar-pro",keyUrl:"https://www.perplexity.ai/settings/api"},
  {id:"minimax",name:"MiniMax",baseUrl:"https://api.minimax.io/v1",model:"MiniMax-M2.5",keyUrl:"https://platform.minimax.io/user-center/basic-information/interface-key"},
  {id:"ollama",name:"Ollama (Local)",baseUrl:"http://localhost:11434/v1",model:"llama3.2",keyUrl:"https://ollama.com"},
  {id:"custom",name:"Custom OpenAI-compatible",baseUrl:"",model:"",keyUrl:""}
 ]}
 providerDefaults(name){const p=this.providerCatalog().find(x=>x.id===name);return p?{baseUrl:p.baseUrl,model:p.model}:{}}
 encryptKey(key){if(!key)return "";if(!safeStorage.isEncryptionAvailable())throw new Error("Secure credential storage is unavailable on this computer.");try{return safeStorage.encryptString(String(key)).toString("base64")}catch(e){throw new Error("Could not protect the API key: "+e.message)}}
 decryptKey(v){try{return v&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(v,"base64")):String(v||"")}catch{return String(v||"")}}
 publicSettings(){return{provider:this._settings.provider,baseUrl:this._settings.baseUrl,model:this._settings.model,maxSteps:this._settings.maxSteps,hasApiKey:Boolean(this._settings.apiKey)}}
 set settings(v){const previous=this._settings||{},input=v||{},providerChanged=input.provider&&input.provider!==previous.provider;this._settings={...previous,...input};if(input.apiKey==="")this._settings.apiKey=providerChanged? "":(previous.apiKey||"");const p=this.providerDefaults(this._settings.provider);if(providerChanged){if(input.baseUrl===undefined||input.baseUrl===previous.baseUrl)this._settings.baseUrl=p.baseUrl;if(input.model===undefined||input.model===previous.model)this._settings.model=p.model}if(!this._settings.baseUrl)this._settings.baseUrl=p.baseUrl;if(!this._settings.model)this._settings.model=p.model;this.persistSettings()}
 get settings(){return this._settings}
 persistSettings(){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({...this._settings,apiKey:this.encryptKey(this._settings.apiKey)},null,2))}catch(e){console.error("Settings save failed:",e)}}
 saveHistory(){try{fs.writeFileSync(this.historyFile,JSON.stringify(this.history.slice(-200),null,2))}catch(e){console.error("History save failed:",e)}}
 async run(text,image=null){
  const s=this.settings;if(!String(text).trim())return "Please tell me what you want me to do.";if(!s.apiKey&&s.provider!=="ollama")return "No AI provider is connected yet. Connect an AI provider or add an API key before sending requests.";
  const userContent=image?[{type:"text",text:String(text)},{type:"image_url",image_url:{url:image}}]:String(text);const messages=[{role:"system",content:"You are Saeed, a persistent desktop AI agent. Accomplish the user's actual goal, inspect first when needed, use tools, observe results, verify important actions, recover from failures, and continue until the goal is complete. Never claim success without evidence. Ask before destructive, credential, financial, privacy-sensitive, or irreversible actions."},...this.history.slice(-30),{role:"user",content:userContent}];
  for(let step=0;step<Math.min(100,Math.max(1,Number(s.maxSteps)||32));step++){
   this.onEvent({type:"thinking",step});const d=this.providerDefaults(s.provider),base=(s.baseUrl||d.baseUrl||"http://localhost:11434/v1").replace(/\/$/,"");const headers={"Content-Type":"application/json"};if(s.apiKey)headers.Authorization="Bearer "+s.apiKey;const body={model:s.model||d.model||"llama3.2",messages,tools:this.registry.schemas(),tool_choice:"auto",temperature:.1};
   let r;try{r=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify(body)})}catch(e){throw new Error("Could not connect to the AI provider: "+e.message)}if(!r.ok)throw new Error(await r.text());const m=(await r.json()).choices?.[0]?.message;if(!m)throw new Error("No model response");
   if(!m.tool_calls?.length){const answer=m.content||"";this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();this.onEvent({type:"answer",text:answer});return answer}
   messages.push(m);for(const c of m.tool_calls||[]){let a={};try{a=JSON.parse(c.function.arguments||"{}")}catch{messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:false,error:"Invalid tool arguments"})});continue}this.onEvent({type:"tool",name:c.function.name,args:a});let out;try{out=await this.registry.call(c.function.name,a)}catch(e){out={ok:false,error:e.message}}if(out?.ok===false)this.onEvent({type:"tool_error",name:c.function.name,error:out.error||"Tool failed"});else this.onEvent({type:"tool_result",name:c.function.name,result:out});if(c.function.name==="screenshot"&&out.ok&&out.image){messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify({ok:true,description:"Screenshot captured."})});messages.push({role:"user",content:[{type:"text",text:"Inspect this current screen image and continue the task."},{type:"image_url",image_url:{url:out.image}}]})}else messages.push({role:"tool",tool_call_id:c.id,content:JSON.stringify(out)})}
  }
  const answer="I stopped after reaching the safe step limit. You can continue the task without losing the conversation history.";this.history.push({role:"user",content:String(text)},{role:"assistant",content:answer});this.saveHistory();return answer
 }
}
module.exports={Agent};
