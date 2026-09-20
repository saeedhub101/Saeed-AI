const os=require("os"),fs=require("fs"),path=require("path"),{Computer}=require("./computer"),{Memory}=require("./memory");
class ToolRegistry{
 constructor({captureScreen}){this.computer=new Computer();this.captureScreen=captureScreen;this.tasks=[];this.memory=new Memory()}
 schemas(){return[
 {type:"function",function:{name:"system_info",description:"Inspect CPU, memory, Windows version and uptime.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"list_directory",description:"List a directory.",parameters:{type:"object",properties:{directory:{type:"string"}},required:["directory"]}}},
 {type:"function",function:{name:"read_file",description:"Read a UTF-8 text file.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"add_task",description:"Persist a task.",parameters:{type:"object",properties:{title:{type:"string"}},required:["title"]}}},
 {type:"function",function:{name:"list_tasks",description:"List saved tasks.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"complete_task",description:"Complete a task.",parameters:{type:"object",properties:{id:{type:"string"}},required:["id"]}}},
 {type:"function",function:{name:"open_application",description:"Open a Windows application requested by the user.",parameters:{type:"object",properties:{application:{type:"string"}},required:["application"]}}},
 {type:"function",function:{name:"open_url",description:"Open an HTTP/HTTPS URL.",parameters:{type:"object",properties:{url:{type:"string"}},required:["url"]}}},
 {type:"function",function:{name:"web_search",description:"Search the web for current information.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}}},
 {type:"function",function:{name:"screenshot",description:"Capture the current screen for visual inspection.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"mouse_move",description:"Move the mouse to screen coordinates.",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"}},required:["x","y"]}}},
 {type:"function",function:{name:"mouse_click",description:"Click at screen coordinates. Use only for a requested action.",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"},button:{type:"string",enum:["left","right"]}},required:["x","y"]}}},
 {type:"function",function:{name:"type_text",description:"Type text into the currently focused application.",parameters:{type:"object",properties:{text:{type:"string"}},required:["text"]}}},
 {type:"function",function:{name:"key_press",description:"Press a Windows key such as ENTER, ESC, TAB, CTRL+C.",parameters:{type:"object",properties:{key:{type:"string"}},required:["key"]}}},
 {type:"function",function:{name:"remember",description:"Remember a fact explicitly requested by the user.",parameters:{type:"object",properties:{fact:{type:"string"}},required:["fact"]}}},
 {type:"function",function:{name:"recall",description:"Search persistent memory.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}}]}
 }
 async call(n,a){
  if(n==="system_info")return{ok:true,platform:process.platform,release:os.release(),arch:process.arch,cpu:os.cpus().length,totalMemory:os.totalmem(),freeMemory:os.freemem(),uptime:os.uptime()};
  if(n==="list_directory")return{ok:true,files:fs.readdirSync(path.resolve(a.directory||"."),{withFileTypes:true}).map(x=>({name:x.name,directory:x.isDirectory()}))};
  if(n==="read_file")return{ok:true,content:fs.readFileSync(path.resolve(a.filePath),"utf8").slice(0,200000)};
  if(n==="add_task"){const t={id:Date.now().toString(),title:a.title,done:false};this.tasks.push(t);return{ok:true,task:t}};
  if(n==="list_tasks")return{ok:true,tasks:this.tasks};
  if(n==="complete_task"){const t=this.tasks.find(x=>x.id===a.id);if(!t)return{ok:false,error:"Task not found"};t.done=true;return{ok:true,task:t}};
  if(n==="open_application")return this.computer.openApp(a.application);
  if(n==="open_url"){if(!/^https?:\/\//i.test(a.url))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};await require("electron").shell.openExternal(a.url);return{ok:true}};
  if(n==="web_search"){const q=encodeURIComponent(a.query);const r=await fetch("https://html.duckduckgo.com/html/?q="+q,{headers:{"User-Agent":"SaeedAI/1.0"}});const html=await r.text();const out=[...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].slice(0,8).map(m=>({url:m[1],title:m[2].replace(/<[^>]+>/g,"")}));return{ok:true,results:out}};
  if(n==="screenshot"){const data=await this.captureScreen();return{ok:true,image:data}};
  if(n==="mouse_move")return this.computer.mouseMove(a.x,a.y);
  if(n==="mouse_click")return this.computer.mouseClick(a.x,a.y,a.button||"left");
  if(n==="type_text")return this.computer.typeText(a.text);
  if(n==="key_press")return this.computer.keyPress(a.key);
  if(n==="remember")return{ok:true,saved:this.memory.add(a.fact)};
  if(n==="recall")return{ok:true,matches:this.memory.search(a.query)};
  return{ok:false,error:"Unknown tool"};
 }}
module.exports={ToolRegistry};