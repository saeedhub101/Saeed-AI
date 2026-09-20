const os=require("os"),fs=require("fs"),path=require("path"),{Computer}=require("./computer");
class ToolRegistry{
 constructor(){this.computer=new Computer();this.tasks=[]}
 schemas(){return[
 {type:"function",function:{name:"system_info",description:"Inspect CPU, memory, Windows version and uptime.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"list_directory",description:"List a directory.",parameters:{type:"object",properties:{directory:{type:"string"}},required:["directory"]}}},
 {type:"function",function:{name:"read_file",description:"Read a UTF-8 text file.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"add_task",description:"Persist a task.",parameters:{type:"object",properties:{title:{type:"string"}},required:["title"]}}},
 {type:"function",function:{name:"open_application",description:"Open a Windows application requested by the user.",parameters:{type:"object",properties:{application:{type:"string"}},required:["application"]}}},
 {type:"function",function:{name:"open_url",description:"Open an HTTP/HTTPS URL.",parameters:{type:"object",properties:{url:{type:"string"}},required:["url"]}}},
 {type:"function",function:{name:"remember",description:"Remember a fact explicitly requested by the user.",parameters:{type:"object",properties:{fact:{type:"string"}},required:["fact"]}}},
 {type:"function",function:{name:"recall",description:"Search persistent memory.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}}}
 ]}
 async call(n,a){
  if(n==="system_info")return{ok:true,platform:process.platform,release:os.release(),arch:process.arch,cpu:os.cpus().length,totalMemory:os.totalmem(),freeMemory:os.freemem(),uptime:os.uptime()};
  if(n==="list_directory")return{ok:true,files:fs.readdirSync(path.resolve(a.directory||"."),{withFileTypes:true}).map(x=>({name:x.name,directory:x.isDirectory()}))};
  if(n==="read_file")return{ok:true,content:fs.readFileSync(path.resolve(a.filePath),"utf8").slice(0,200000)};
  if(n==="add_task"){this.tasks.push({id:Date.now().toString(),title:a.title,done:false});return{ok:true,tasks:this.tasks}};
  if(n==="open_application")return this.computer.openApp(a.application);
  if(n==="open_url"){if(!/^https?:\/\//i.test(a.url))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};await require("electron").shell.openExternal(a.url);return{ok:true}};
  if(n==="remember"){this.memory??=new (require("./memory").Memory)();return{ok:true,saved:this.memory.add(a.fact)}}
  if(n==="recall"){this.memory??=new (require("./memory").Memory)();return{ok:true,matches:this.memory.search(a.query)}}
  return{ok:false,error:"Unknown tool"};
 }}
module.exports={ToolRegistry};