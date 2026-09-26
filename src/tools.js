const os=require("os"),fs=require("fs"),path=require("path"),{Computer}=require("./computer"),{Memory}=require("./memory"),{OfficeTools}=require("./office");
const {shell}=require("electron");
const {PermissionEngine}=require("./permissions");
const {VerificationEngine}=require("./verification_engine");
const {PumpCatalog}=require("./pump_catalog");
const {ApplicationAdapter}=require("./application_adapter");
const {DatabaseAdapter}=require("./database_adapter");
const {PumpSchemaMapper}=require("./pump_schema_mapper");
const {PumpImportPlanner}=require("./pump_import_planner");
const {ApplicationUIMapper}=require("./application_ui_mapper");
const {EmailService}=require("./email_service");

class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm}){this.computer=new Computer();this.office=new OfficeTools();this.captureScreen=captureScreen;this.confirm=confirm|| (async()=>false);this.userDataPath=userDataPath||process.cwd();this.permissionFile=path.join(this.userDataPath,"permissions.json");const saved=this.loadPermissions();this.permissions=new PermissionEngine({confirm:this.confirm,policy:saved});this.verifier=new VerificationEngine({computer:this.computer});this.pumpCatalog=new PumpCatalog();this.appAdapter=new ApplicationAdapter(this.computer);this.dbAdapter=new DatabaseAdapter(this.computer);this.pumpSchemaMapper=new PumpSchemaMapper();this.pumpImportPlanner=new PumpImportPlanner();this.appUIMapper=new ApplicationUIMapper();this.memory=new Memory();this.email=new EmailService({getConfig:()=>this.emailConfig()});this.taskFile=path.join(this.userDataPath,"tasks.json");this.tasks=this.loadTasks()}
 loadTasks(){try{return JSON.parse(fs.readFileSync(this.taskFile,"utf8"))}catch{return[]}}
 loadPermissions(){try{return JSON.parse(fs.readFileSync(this.permissionFile,"utf8"))}catch{return null}}
 setPermissionPolicy(policy){const p=this.permissions.setPolicy(policy||{});try{fs.mkdirSync(this.userDataPath,{recursive:true});fs.writeFileSync(this.permissionFile,JSON.stringify(p,null,2),"utf8")}catch(e){console.error("Permissions save failed:",e)}return p}
 getPermissionPolicy(){return this.permissions.getPolicy()}
 emailConfig(){return this.emailSettings||{}}
 setEmailSettings(settings={}){this.emailSettings={...(this.emailSettings||{}),...(settings||{})};return this.emailSettings}
 getEmailSettings(){return {...(this.emailSettings||{}),password:"",hasPassword:Boolean(this.emailSettings?.password)}}
 permissionCategories(){return this.permissions.getCategories()}
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
 {type:"function",function:{name:"observe_computer",description:"Observe the active window and visible windows before or after GUI actions.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"verify_state",description:"Verify a result against observable local state. Use after important actions.",parameters:{type:"object",properties:{kind:{type:"string"},expected:{type:"object"},before:{type:"object"},after:{type:"object"}},required:["kind"]}}},
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
 {type:"function",function:{name:"pdf_extract_text",description:"Extract PDF text using an installed Windows PDF text utility when available.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"pdf_search",description:"Search a PDF text layer and return matching page numbers/snippets. Useful for locating pump tables, dimensions and performance-curve pages before visual inspection.",parameters:{type:"object",properties:{filePath:{type:"string"},query:{type:"string"}},required:["filePath","query"]}}},
 {type:"function",function:{name:"inspect_database",description:"Inspect a discovered local database in read-only mode. Detect its format and, when supported, inspect schema without changing data.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"read_database_query",description:"Read data from a supported local SQLite database using a single SELECT or PRAGMA query. Never modifies database contents.",parameters:{type:"object",properties:{filePath:{type:"string"},sql:{type:"string"}},required:["filePath","sql"]}}},
 {type:"function",function:{name:"discover_application",description:"Inspect a Windows application by process name or window title. Discover executable path, command line and nearby database files, then choose API/database, UI Automation, mouse/keyboard or vision strategy.",parameters:{type:"object",properties:{target:{type:"string"}},required:["target"]}}},
 {type:"function",function:{name:"ui_automation_action",description:"Perform a Windows UI Automation action on a discovered application control. Supports invoke, set_value, select and toggle; prefer this over coordinate automation when a stable UI Automation selector exists.",parameters:{type:"object",properties:{pid:{type:"integer"},action:{type:"string",enum:["invoke","set_value","select","toggle"]},selector:{type:"object",properties:{name:{type:"string"},automationId:{type:"string"},controlType:{type:"string"},value:{type:"string"}}}},required:["pid","action","selector"]}}},
 {type:"function",function:{name:"inspect_application_ui",description:"Inspect the visible UI Automation control tree of a Windows application. Use this before mouse/keyboard coordinates when UI Automation is available.",parameters:{type:"object",properties:{pid:{type:"integer"}},required:["pid"]}}},
 {type:"function",function:{name:"pump_map_application_ui",description:"Map visible application UI controls to common pump fields without clicking or changing anything.",parameters:{type:"object",properties:{elements:{type:"array",items:{type:"object"}},target:{type:"object"}},required:["elements"]}}},
 {type:"function",function:{name:"pump_map_database_schema",description:"Map discovered database columns to pump-record fields without changing database contents.",parameters:{type:"object",properties:{table:{type:"string"},columns:{type:"array",items:{}}},required:["table","columns"]}}},
 {type:"function",function:{name:"pump_create_import_plan",description:"Create a dry-run pump import plan from a normalized record and target mapping. Never writes to the target application.",parameters:{type:"object",properties:{record:{type:"object"},target:{type:"object"},mapping:{type:"object"}},required:["record","target","mapping"]}}},
 {type:"function",function:{name:"pump_normalize_record",description:"Normalize and validate extracted pump catalog data into a structured pump record. Keep source page/provenance and uncertainties; never invent missing values.",parameters:{type:"object",properties:{manufacturer:{type:"string"},series:{type:"string"},model:{type:"string"},productCode:{type:"string"},description:{type:"string"},units:{type:"object"},flow:{},head:{},pressure:{},power:{},rpm:{},efficiency:{},temperature:{},length:{},width:{},height:{},diameter:{},connection:{},motorPower:{},motorRpm:{},voltage:{},frequency:{},materials:{type:"object"},curve:{type:"array",items:{type:"object"}},sources:{type:"array",items:{type:"object"}},uncertainties:{type:"array",items:{type:"string"}},confidence:{type:"string"}},required:["model","sources"]}}},
 {type:"function",function:{name:"email_test_connection",description:"Test the configured email account using IMAP or POP3 for incoming mail and SMTP for outgoing mail. Uses saved email credentials.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"email_list",description:"List recent emails from the configured inbox.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:100}},required:[]}}},
 {type:"function",function:{name:"email_search",description:"Search the configured inbox by sender, recipient, subject or message body when IMAP is available.",parameters:{type:"object",properties:{query:{type:"string"},limit:{type:"integer",minimum:1,maximum:100}},required:["query"]}}},
 {type:"function",function:{name:"email_read",description:"Read one email by IMAP UID or POP3 message number.",parameters:{type:"object",properties:{uid:{type:"integer"},number:{type:"integer"}},required:[]}}},
 {type:"function",function:{name:"email_send",description:"Send an email through the configured SMTP account. Use only when the user asks Saeed to send it.",parameters:{type:"object",properties:{to:{type:"string"},subject:{type:"string"},text:{type:"string"},html:{type:"string"},cc:{type:"string"},bcc:{type:"string"}},required:["to","subject","text"]}}},
 {type:"function",function:{name:"pdf_render_pages",description:"Render selected PDF pages to images for visual inspection of tables, performance curves and dimension drawings. Use after pdf_search or when the PDF text layer is insufficient.",parameters:{type:"object",properties:{filePath:{type:"string"},pages:{type:"array",items:{type:"integer"}},dpi:{type:"integer"}},required:["filePath","pages"]}}}
 ]}
 async call(n,a){try{
  const auth=await this.permissions.authorize(n,a||{});
  if(!auth.allowed)return{ok:false,error:"User denied permission.",permission:auth.permission||null,denied:true};
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
  if(n==="write_file"){const p=path.resolve(a.filePath);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,String(a.content),"utf8");return{ok:true,path:p,bytes:Buffer.byteLength(String(a.content))}};
  if(n==="add_task"){const t={id:Date.now().toString(),title:String(a.title),done:false,created:new Date().toISOString()};this.tasks.push(t);this.saveTasks();return{ok:true,task:t}};
  if(n==="list_tasks")return{ok:true,tasks:this.tasks};
  if(n==="complete_task"){const t=this.tasks.find(x=>x.id===a.id);if(!t)return{ok:false,error:"Task not found"};t.done=true;t.completed=new Date().toISOString();this.saveTasks();return{ok:true,task:t}};
  if(n==="remove_task"){const before=this.tasks.length;this.tasks=this.tasks.filter(x=>x.id!==a.id);this.saveTasks();return{ok:this.tasks.length!==before}};
  if(n==="open_application")return this.computer.openApp(a.application);
  if(n==="reveal_file"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"File not found"};shell.showItemInFolder(p);return{ok:true,path:p}}
  if(n==="open_url"){if(!/^https?:\/\//i.test(a.url))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};await require("electron").shell.openExternal(a.url);return{ok:true,url:a.url}};
  if(n==="web_search"){const q=encodeURIComponent(a.query);const r=await fetch("https://html.duckduckgo.com/html/?q="+q,{headers:{"User-Agent":"SaeedAI/1.0"}});const html=await r.text();const out=[...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].slice(0,8).map(m=>({url:m[1],title:m[2].replace(/<[^>]+>/g,"")}));return{ok:true,results:out}};
  if(n==="screenshot")return{ok:true,image:await this.captureScreen()};
  if(n==="observe_computer")return this.computer.observe();
  if(n==="verify_state")return this.verifier.verify(a.kind,a.expected||{},a.before||null,a.after||null);
  if(n==="mouse_move")return this.computer.mouseMove(a.x,a.y);
  if(n==="mouse_click")return this.computer.clickAndObserve(a.x,a.y,a.button||"left");
  if(n==="type_text")return this.computer.typeAndObserve(a.text);
  if(n==="key_press")return this.computer.keyAndObserve(a.key);
  if(n==="remember")return{ok:true,saved:this.memory.add(a.fact)};
  if(n==="recall")return{ok:true,matches:this.memory.search(a.query)};
  if(n==="run_command")return this.computer.runCommand(a.command,a.workingDirectory||process.cwd());
  if(n==="copy_file"){const s=path.resolve(a.source),d=path.resolve(a.destination);if(!fs.existsSync(s))return{ok:false,error:"Source not found"};fs.cpSync(s,d,{recursive:true});return{ok:fs.existsSync(d),source:s,destination:d}};
  if(n==="move_file"){const s=path.resolve(a.source),d=path.resolve(a.destination);if(!fs.existsSync(s))return{ok:false,error:"Source not found"};fs.mkdirSync(path.dirname(d),{recursive:true});fs.renameSync(s,d);return{ok:fs.existsSync(d),source:s,destination:d}};
  if(n==="delete_file"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"Path not found"};fs.rmSync(p,{recursive:Boolean(a.recursive),force:false});return{ok:!fs.existsSync(p),path:p}};
  if(n==="create_directory"){const p=path.resolve(a.directory);fs.mkdirSync(p,{recursive:true});return{ok:true,path:p}};
  if(n==="excel_inspect")return this.office.excel("inspect",a);
  if(n==="excel_read_cell")return this.office.excel("read_cell",a);
  if(n==="excel_write_cell")return this.office.excel("write_cell",a);
  if(n==="excel_append_rows")return this.office.excel("append_rows",a);
  if(n==="excel_create")return this.office.excel("create",a);
  if(n==="word_read_text")return this.office.word("read_text",a);
  if(n==="word_replace_text")return this.office.word("replace_text",a);
  if(n==="pdf_extract_text"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};const r=await this.computer.runCommand("pdftotext -layout \""+p.replace(/"/g,'""')+"\" -",process.cwd());return {...r,text:String(r.stdout||"")};}
  if(n==="pdf_search"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};const r=await this.computer.runCommand("pdftotext -layout \""+p.replace(/"/g,'""')+"\" -",process.cwd());if(r.ok===false)return r;const pages=String(r.stdout||"").split("\f");const q=String(a.query||"").toLowerCase();const matches=[];pages.forEach((txt,i)=>{if(q&&txt.toLowerCase().includes(q))matches.push({page:i+1,snippet:txt.slice(Math.max(0,txt.toLowerCase().indexOf(q)-350),Math.min(txt.length,txt.toLowerCase().indexOf(q)+q.length+700))})});return{ok:true,query:a.query,pages:matches};}
  if(n==="inspect_database")return this.dbAdapter.inspect(a.filePath);
  if(n==="read_database_query")return this.dbAdapter.readSqlite(a.filePath,a.sql);
  if(n==="discover_application")return this.appAdapter.discover(a.target);
  if(n==="inspect_application_ui")return this.appAdapter.inspectUI(a.pid);
  if(n==="ui_automation_action")return this.appAdapter.actUI(a.pid,a.action,a.selector||{});
  if(n==="pump_normalize_record")return this.pumpCatalog.normalize(a);
  if(n==="pump_map_database_schema")return this.pumpSchemaMapper.mapTable(a.table,a.columns);
  if(n==="pump_map_application_ui")return this.appUIMapper.plan(a.elements,a.target||{});
  if(n==="pump_create_import_plan")return this.pumpImportPlanner.plan(a.record,a.target,a.mapping);
  if(n==="email_test_connection")return this.email.test();
  if(n==="email_list")return this.email.list({limit:Number(a.limit||20)});
  if(n==="email_search")return this.email.search({query:String(a.query||""),limit:Number(a.limit||20)});
  if(n==="email_read")return this.email.read({uid:a.uid,number:a.number});
  if(n==="email_send")return this.email.send({to:a.to,subject:a.subject,text:a.text,html:a.html,cc:a.cc,bcc:a.bcc});
  if(n==="pdf_render_pages"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};const pages=[...(a.pages||[])].filter(n=>Number.isInteger(n)&&n>0).slice(0,8);if(!pages.length)return{ok:false,error:"At least one page number is required"};const dpi=Math.min(180,Math.max(72,Number(a.dpi)||120));const tmp=path.join(this.userDataPath,"pdf-render");fs.mkdirSync(tmp,{recursive:true});const images=[];for(const page of pages){const prefix=path.join(tmp,"page-"+page+"-"+Date.now());const r=await this.computer.runCommand("pdftoppm -f "+page+" -singlefile -r "+dpi+" -jpeg \""+p.replace(/"/g,'""')+"\" \""+prefix.replace(/"/g,'""')+"\"",process.cwd());if(r.ok===false)continue;const jpg=prefix+".jpg";if(fs.existsSync(jpg)){images.push({page,path:jpg,dataUrl:"data:image/jpeg;base64,"+fs.readFileSync(jpg).toString("base64")})}}return{ok:images.length>0,pages:images};}
  return{ok:false,error:"Unknown tool"};
 }catch(e){return{ok:false,error:e.message}}}
}
module.exports={ToolRegistry};