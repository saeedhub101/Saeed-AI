const os=require("os"),fs=require("fs"),path=require("path"),{Computer}=require("./computer"),{Memory}=require("./memory"),{OfficeTools}=require("./office");
const {shell}=require("electron");

class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm}){this.computer=new Computer();this.office=new OfficeTools();this.captureScreen=captureScreen;this.confirm=confirm|| (async()=>false);this.userDataPath=userDataPath||process.cwd();this.memory=new Memory();this.taskFile=path.join(this.userDataPath,"tasks.json");this.tasks=this.loadTasks()}
 loadTasks(){try{return JSON.parse(fs.readFileSync(this.taskFile,"utf8"))}catch{return[]}}
 saveTasks(){fs.mkdirSync(this.userDataPath,{recursive:true});fs.writeFileSync(this.taskFile,JSON.stringify(this.tasks,null,2),"utf8")}
 schemas(){return[
 {type:"function",function:{name:"system_info",description:"Inspect CPU, memory, Windows version, architecture and uptime.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"diagnose_computer",description:"Run a combined Windows health check: OS, CPU load, memory, disks, and top processes. Use this first for broad 'why is my computer slow/problem' requests.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"active_window",description:"Inspect the currently focused Windows window and process id.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"list_windows",description:"List visible Windows application windows.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"focus_window",description:"Focus a visible Windows application by process id.",parameters:{type:"object",properties:{pid:{type:"integer"}},required:["pid"]}}},
 {type:"function",function:{name:"process_list",description:"Inspect running Windows processes and resource usage.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"disk_info",description:"Inspect Windows drive capacity and free space.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"network_info",description:"Inspect active Windows network adapters and IP addresses.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"list_directory",description:"List a directory.",parameters:{type:"object",properties:{directory:{type:"string"}},required:["directory"]}}},
 {type:"function",function:{name:"read_file",description:"Read a UTF-8 text file.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"write_file",description:"Write or replace a UTF-8 text file. Use only when the user requested a file change.",parameters:{type:"object",properties:{filePath:{type:"string"},content:{type:"string"}},required:["filePath","content"]}}},
 {type:"function",function:{name:"add_task",description:"Persist a task.",parameters:{type:"object",properties:{title:{type:"string"}},required:["title"]}}},
 {type:"function",function:{name:"list_tasks",description:"List saved tasks.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"complete_task",description:"Complete a task.",parameters:{type:"object",properties:{id:{type:"string"}},required:["id"]}}},
 {type:"function",function:{name:"remove_task",description:"Remove a saved task by id.",parameters:{type:"object",properties:{id:{type:"string"}},required:["id"]}}},
 {type:"function",function:{name:"open_application",description:"Open a Windows application requested by the user.",parameters:{type:"object",properties:{application:{type:"string"}},required:["application"]}}},
 {type:"function",function:{name:"reveal_file",description:"Open File Explorer and reveal a local file.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"open_url",description:"Open an HTTP/HTTPS URL.",parameters:{type:"object",properties:{url:{type:"string"}},required:["url"]}}},
 {type:"function",function:{name:"web_search",description:"Search the web for current information.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}}},
 {type:"function",function:{name:"screenshot",description:"Capture the current screen for visual inspection.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"mouse_move",description:"Move the mouse to screen coordinates.",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"}},required:["x","y"]}}},
 {type:"function",function:{name:"mouse_click",description:"Click at screen coordinates for a requested action.",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"},button:{type:"string",enum:["left","right"]}},required:["x","y"]}}},
 {type:"function",function:{name:"type_text",description:"Type text into the currently focused application.",parameters:{type:"object",properties:{text:{type:"string"}},required:["text"]}}},
 {type:"function",function:{name:"key_press",description:"Press Windows keyboard keys. Examples: ENTER, ESC, CTRL+C, CTRL+V, ALT+F4.",parameters:{type:"object",properties:{key:{type:"string"}},required:["key"]}}},
 {type:"function",function:{name:"remember",description:"Remember a fact explicitly requested by the user.",parameters:{type:"object",properties:{fact:{type:"string"}},required:["fact"]}}},
 {type:"function",function:{name:"recall",description:"Search persistent memory.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}}},
 {type:"function",function:{name:"run_command",description:"Run a Windows command or PowerShell command needed to complete the user task. Inspect first and verify the result. Use for development, build, conversion, and application automation.",parameters:{type:"object",properties:{command:{type:"string"},workingDirectory:{type:"string"}},required:["command"]}}},
 {type:"function",function:{name:"copy_file",description:"Copy a local file or directory.",parameters:{type:"object",properties:{source:{type:"string"},destination:{type:"string"}},required:["source","destination"]}}},
 {type:"function",function:{name:"move_file",description:"Move or rename a local file or directory.",parameters:{type:"object",properties:{source:{type:"string"},destination:{type:"string"}},required:["source","destination"]}}},
 {type:"function",function:{name:"delete_file",description:"Delete a local file or directory. Use only when the user explicitly requested deletion.",parameters:{type:"object",properties:{filePath:{type:"string"},recursive:{type:"boolean"}},required:["filePath"]}}},
 {type:"function",function:{name:"create_directory",description:"Create a local directory.",parameters:{type:"object",properties:{directory:{type:"string"}},required:["directory"]}}},
 {type:"function",function:{name:"excel_inspect",description:"Inspect an Excel workbook and list sheets/used ranges.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"excel_read_cell",description:"Read a specific Excel cell.",parameters:{type:"object",properties:{filePath:{type:"string"},sheet:{type:"string"},cell:{type:"string"}},required:["filePath","sheet","cell"]}}},
 {type:"function",function:{name:"excel_write_cell",description:"Write a value to an Excel cell, save the workbook, and verify the written value.",parameters:{type:"object",properties:{filePath:{type:"string"},sheet:{type:"string"},cell:{type:"string"},value:{}},required:["filePath","sheet","cell","value"]}}},
 {type:"function",function:{name:"excel_append_rows",description:"Append rows of values to an Excel worksheet and save.",parameters:{type:"object",properties:{filePath:{type:"string"},sheet:{type:"string"},rows:{type:"array",items:{type:"array",items:{}}}},required:["filePath","sheet","rows"]}}},
 {type:"function",function:{name:"excel_create",description:"Create a new .xlsx workbook.",parameters:{type:"object",properties:{outputPath:{type:"string"}},required:["outputPath"]}}},
 {type:"function",function:{name:"word_read_text",description:"Read text from a Word document.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"word_replace_text",description:"Replace text in a Word document and save it.",parameters:{type:"object",properties:{filePath:{type:"string"},findText:{type:"string"},replaceText:{type:"string"}},required:["filePath","findText","replaceText"]}}},
 {type:"function",function:{name:"pdf_extract_text",description:"Extract PDF text using an installed Windows PDF text utility when available.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}}
 ]}
 async call(n,a){try{
  if(n==="system_info")return{ok:true,platform:process.platform,release:os.release(),arch:process.arch,cpu:os.cpus().length,totalMemory:os.totalmem(),freeMemory:os.freemem(),uptime:os.uptime()};
  if(n==="diagnose_computer")return this.computer.diagnose();
  if(n==="active_window")return this.computer.activeWindow();
  if(n==="list_windows")return this.computer.listWindows();
  if(n==="focus_window")return this.computer.focusWindow(a.pid);
  if(n==="process_list")return this.computer.processes();
  if(n==="disk_info"){const r=await this.computer.powershell("Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select DeviceID,Size,FreeSpace | ConvertTo-Json -Compress");try{return{ok:true,drives:JSON.parse(r.stdout)}}catch{return{ok:true,drives:[]}}}
  if(n==="network_info"){const r=await this.computer.powershell("Get-NetIPConfiguration | Select InterfaceAlias,IPv4Address,IPv6Address,DNSServer | ConvertTo-Json -Compress");try{return{ok:true,adapters:JSON.parse(r.stdout)}}catch{return{ok:true,adapters:[]}}}
  if(n==="list_directory")return{ok:true,files:fs.readdirSync(path.resolve(a.directory||"."),{withFileTypes:true}).map(x=>({name:x.name,directory:x.isDirectory()}))};
  if(n==="read_file")return{ok:true,content:fs.readFileSync(path.resolve(a.filePath),"utf8").slice(0,200000)};
  if(n==="write_file"){if(!(await this.confirm({name:n,args:a})))return{ok:false,error:"User denied the file change."};const p=path.resolve(a.filePath);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,String(a.content),"utf8");return{ok:true,path:p,bytes:Buffer.byteLength(String(a.content))}};
  if(n==="add_task"){const t={id:Date.now().toString(),title:String(a.title),done:false,created:new Date().toISOString()};this.tasks.push(t);this.saveTasks();return{ok:true,task:t}};
  if(n==="list_tasks")return{ok:true,tasks:this.tasks};
  if(n==="complete_task"){const t=this.tasks.find(x=>x.id===a.id);if(!t)return{ok:false,error:"Task not found"};t.done=true;t.completed=new Date().toISOString();this.saveTasks();return{ok:true,task:t}};
  if(n==="remove_task"){if(!(await this.confirm({name:n,args:a})))return{ok:false,error:"User denied removing the task."};const before=this.tasks.length;this.tasks=this.tasks.filter(x=>x.id!==a.id);this.saveTasks();return{ok:this.tasks.length!==before}};
  if(n==="open_application")return this.computer.openApp(a.application);
  if(n==="reveal_file"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"File not found"};shell.showItemInFolder(p);return{ok:true,path:p}}
  if(n==="open_url"){if(!/^https?:\/\//i.test(a.url))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};await require("electron").shell.openExternal(a.url);return{ok:true,url:a.url}};
  if(n==="web_search"){const q=encodeURIComponent(a.query);const r=await fetch("https://html.duckduckgo.com/html/?q="+q,{headers:{"User-Agent":"SaeedAI/1.0"}});const html=await r.text();const out=[...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].slice(0,8).map(m=>({url:m[1],title:m[2].replace(/<[^>]+>/g,"")}));return{ok:true,results:out}};
  if(n==="screenshot")return{ok:true,image:await this.captureScreen()};
  if(n==="mouse_move")return this.computer.mouseMove(a.x,a.y);
  if(n==="mouse_click")return this.computer.mouseClick(a.x,a.y,a.button||"left");
  if(n==="type_text")return this.computer.typeText(a.text);
  if(n==="key_press")return this.computer.keyPress(a.key);
  if(n==="remember")return{ok:true,saved:this.memory.add(a.fact)};
  if(n==="recall")return{ok:true,matches:this.memory.search(a.query)};
  if(n==="run_command")return this.computer.runCommand(a.command,a.workingDirectory||process.cwd());
  if(n==="copy_file"){const s=path.resolve(a.source),d=path.resolve(a.destination);if(!fs.existsSync(s))return{ok:false,error:"Source not found"};fs.cpSync(s,d,{recursive:true});return{ok:fs.existsSync(d),source:s,destination:d}};
  if(n==="move_file"){const s=path.resolve(a.source),d=path.resolve(a.destination);if(!fs.existsSync(s))return{ok:false,error:"Source not found"};fs.mkdirSync(path.dirname(d),{recursive:true});fs.renameSync(s,d);return{ok:fs.existsSync(d),source:s,destination:d}};
  if(n==="delete_file"){const p=path.resolve(a.filePath);if(!(await this.confirm({name:n,args:a})))return{ok:false,error:"User denied deletion."};if(!fs.existsSync(p))return{ok:false,error:"Path not found"};fs.rmSync(p,{recursive:Boolean(a.recursive),force:false});return{ok:!fs.existsSync(p),path:p}};
  if(n==="create_directory"){const p=path.resolve(a.directory);fs.mkdirSync(p,{recursive:true});return{ok:true,path:p}};
  if(n==="excel_inspect")return this.office.excel("inspect",a);
  if(n==="excel_read_cell")return this.office.excel("read_cell",a);
  if(n==="excel_write_cell")return this.office.excel("write_cell",a);
  if(n==="excel_append_rows")return this.office.excel("append_rows",a);
  if(n==="excel_create")return this.office.excel("create",a);
  if(n==="word_read_text")return this.office.word("read_text",a);
  if(n==="word_replace_text")return this.office.word("replace_text",a);
  if(n==="pdf_extract_text"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};return this.computer.runCommand("pdftotext -layout \""+p.replace(/"/g,'""')+"\" -",process.cwd());}
  return{ok:false,error:"Unknown tool"};
 }catch(e){return{ok:false,error:e.message}}}
}
module.exports={ToolRegistry};