const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage}=require("electron");
const path=require("path"),fs=require("fs"),crypto=require("crypto"),{spawn}=require("child_process"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));

let win,settingsWin,characterWin,agent,tray,realtime;\nlet characterWelcomed=false;
const confirmations=new Map();
const WINDOW={width:760,height:480,minWidth:360,minHeight:260};

async function captureScreen(){
 const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});
 return sources[0]?.thumbnail.toDataURL()||null;
}
function displayForWindow(){
 if(!win)return screen.getPrimaryDisplay();
 const [x,y]=win.getPosition();
 const [w,h]=win.getSize();
 return screen.getDisplayMatching({x,y,width:w,height:h})||screen.getDisplayNearestPoint({x:x+w/2,y:y+h/2})||screen.getPrimaryDisplay();
}
function fitWindowToDisplay(display=displayForWindow(),{bottomRight=false}={}){
 if(!win)return;
 const area=display.workArea;
 const width=Math.min(WINDOW.width,Math.max(WINDOW.minWidth,area.width));
 const height=Math.min(WINDOW.height,Math.max(WINDOW.minHeight,area.height));
 if(win.getSize()[0]!==width||win.getSize()[1]!==height)win.setSize(width,height,false);
 const margin=18;
 const [x0,y0]=win.getPosition();
 const x=bottomRight?area.x+Math.max(0,area.width-width-margin):Math.max(area.x,Math.min(x0,area.x+Math.max(0,area.width-width)));
 const y=bottomRight?area.y+Math.max(0,area.height-height-margin):Math.max(area.y,Math.min(y0,area.y+Math.max(0,area.height-height)));
 win.setPosition(Math.round(x),Math.round(y),false);
}
function placeBottomRight(){
 if(!win)return;
 const display=screen.getPrimaryDisplay();
 fitWindowToDisplay(display,{bottomRight:true});
}
function keepWindowVisible(){
 if(!win)return;
 const display=displayForWindow();
 fitWindowToDisplay(display);
}
function showChat(){keepWindowVisible();win?.show();win?.focus();win?.webContents.send("chat:show")}\nfunction showCharacter(){if(characterWin&&!characterWin.isDestroyed()){characterWin.show();characterWin.focus();}}\nfunction hideCharacter(){characterWin?.hide();}\nfunction speakWelcome(){\n const s=agent?.settings||{};\n if((s.realtimeApiKey||s.apiKey)&&s.provider!=="ollama"){\n  try{if(startRealtime({welcome:true})){setTimeout(()=>{try{realtime?.text("Say exactly: Hello. I am Saeed.")}catch{}},900);return}}catch{}\n }\n if(process.platform==="win32"){try{spawn("powershell.exe",["-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command","Add-Type -AssemblyName System.Speech; $v=New-Object System.Speech.Synthesis.SpeechSynthesizer; $v.Speak('Hello. I am Saeed.'); $v.Dispose()"],{windowsHide:true,stdio:"ignore",detached:true}).unref()}catch{}}\n}
function showSettings(){
 if(settingsWin&&!settingsWin.isDestroyed()){settingsWin.show();settingsWin.focus();return}
 settingsWin=new BrowserWindow({title:"Saeed AI — Settings",width:900,height:680,minWidth:720,minHeight:560,backgroundColor:"#f5f7fb",show:false,icon:path.join(__dirname,"..","assets","saeed.png"),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 settingsWin.setMenuBarVisibility(false);
 settingsWin.on("closed",()=>{settingsWin=null});
 settingsWin.loadFile(path.join(__dirname,"settings-new.html")).then(()=>settingsWin?.show());
}
function setMicMode(mode){
 if(!agent||!["always","push","off"].includes(mode))return;
 agent.settings={...agent.settings,micMode:mode,alwaysListening:mode==="always"};
 if(mode==="off") stopRealtime(); else startRealtime();
 win?.webContents.send("mic:mode",mode);
 rebuildTrayMenu();
}

async function fetchLatestRelease(){
 return new Promise((resolve,reject)=>{
  const https=require("https");
  const req=https.get("https://api.github.com/repos/saeedhub101/Saeed-AI/releases/latest",{headers:{"User-Agent":"Saeed-AI","Accept":"application/vnd.github+json"}},res=>{
   let body="";res.setEncoding("utf8");res.on("data",d=>body+=d);res.on("end",()=>{
    try{
     if(res.statusCode!==200)throw new Error("GitHub returned HTTP "+res.statusCode);
     const r=JSON.parse(body),tag=String(r.tag_name||"").replace(/^v/i,""),current=String(app.getVersion()||"0.0.0");
     const parse=v=>String(v).replace(/^v/i,"").split("-")[0].split(".").map(x=>Number.parseInt(x,10)||0);
     const a=parse(current),b=parse(tag);let cmp=0;for(let i=0;i<3;i++){if(a[i]!==b[i]){cmp=a[i]<b[i]?-1:1;break}}
     const asset=(r.assets||[]).find(x=>/\.exe$/i.test(String(x.name||""))&&!/\.blockmap$|\.sha256$/i.test(String(x.name||"")));
     resolve({currentVersion:current,latestVersion:tag,newer:cmp<0,releaseName:r.name||tag,publishedAt:r.published_at||"",notes:r.body||"",releaseUrl:r.html_url||"",assetUrl:asset?.browser_download_url||"",assetName:asset?.name||"",size:Number(asset?.size||0),digest:asset?.digest||""});
    }catch(e){reject(e)}
   });
  });
  req.on("error",reject);req.setTimeout(10000,()=>req.destroy(new Error("Update check timed out")));
 });
}
function formatBytes(n){if(!Number.isFinite(n)||n<=0)return "Unknown size";const u=["B","KB","MB","GB"];let i=0,x=n;while(x>=1024&&i<u.length-1){x/=1024;i++}return x.toFixed(i?1:0)+" "+u[i]}
async function checkForUpdates(options={}){
 const info=await fetchLatestRelease();
 if(options.showDialog){
  await dialog.showMessageBox(settingsWin||win,{type:"info",title:"Saeed AI Updates",message:info.newer?"A new version is available: v"+info.latestVersion:"Saeed AI is up to date.",detail:info.newer?("Current: v"+info.currentVersion+"\nNew: v"+info.latestVersion+"\nSize: "+formatBytes(info.size)):("Current version: v"+info.currentVersion)});
 }
 return info;
}
function downloadUpdateFile(url,out,onProgress){
 return new Promise((resolve,reject)=>{
  const https=require("https");
  const request=(target,redirects=0)=>{
   if(redirects>5)return reject(new Error("Too many update redirects"));
   const req=https.get(target,{headers:{"User-Agent":"Saeed-AI","Accept":"application/octet-stream"}},res=>{
    if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();return request(new URL(res.headers.location,target).toString(),redirects+1)}
    if(res.statusCode!==200){res.resume();return reject(new Error("Update download returned HTTP "+res.statusCode))}
    const total=Number(res.headers["content-length"]||0);let done=0;
    const file=fs.createWriteStream(out);
    res.on("data",chunk=>{done+=chunk.length;onProgress?.(done,total)});
    res.pipe(file);
    file.on("finish",()=>file.close(()=>resolve({total:done,declared:total})));
    res.on("error",e=>{try{file.destroy()}catch{};reject(e)});
    file.on("error",reject);
   });
   req.on("error",reject);req.setTimeout(120000,()=>req.destroy(new Error("Update download timed out")));
  };
  request(url);
 });
}
async function installUpdate(info){
 if(!info?.assetUrl)throw new Error("No Windows installer is available for this release.");
 const out=path.join(app.getPath("temp"),"Saeed-AI-update-"+Date.now()+".exe");
 settingsWin?.webContents.send("update:status",{state:"downloading",phase:"prepare",text:"Preparing the update…",downloaded:0,total:info.size});
 try{
  const result=await downloadUpdateFile(info.assetUrl,out,(downloaded,total)=>settingsWin?.webContents.send("update:progress",{downloaded,total:total||info.size}));
  settingsWin?.webContents.send("update:status",{state:"verifying",phase:"verify",text:"Download complete. Verifying the installer…",downloaded:result.total,total:info.size});
  if(!fs.existsSync(out)||fs.statSync(out).size<100000)throw new Error("Downloaded installer is missing or incomplete.");
  if(info.digest&&/^sha256:/i.test(info.digest)){
   const hash=crypto.createHash("sha256").update(fs.readFileSync(out)).digest("hex");
   if(hash.toLowerCase()!==String(info.digest).replace(/^sha256:/i,"").toLowerCase())throw new Error("Installer integrity verification failed.");
  }
  settingsWin?.webContents.send("update:status",{state:"installing",phase:"install",text:"Installer verified. Starting installation…",downloaded:result.total,total:info.size});
  const child=spawn(out,["/SILENT","/CLOSEAPPLICATIONS","/NORESTART"],{detached:true,windowsHide:true,stdio:"ignore"});
  child.unref();
  settingsWin?.webContents.send("update:status",{state:"installing",phase:"restart",text:"Installation started. Saeed will close now.",downloaded:result.total,total:info.size});
  setTimeout(()=>app.quit(),700);
  return {ok:true};
 }catch(e){
  try{if(fs.existsSync(out))fs.unlinkSync(out)}catch{}
  settingsWin?.webContents.send("update:status",{state:"error",phase:"error",text:"Update failed: "+e.message});
  throw e;
 }
}
function trayIcon(){
 const iconPath=path.join(__dirname,"..","assets","saeed.png");
 return nativeImage.createFromPath(iconPath);
}
function rebuildTrayMenu(){
 if(!tray||!agent)return;
 const mode=agent.settings?.micMode||"off";
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:"Show Saeed",click:showCharacter},\n  {label:"Chat",click:showChat},
  {type:"separator"},
  {label:"Always Listening",type:"radio",checked:mode==="always",click:()=>setMicMode("always")},
  {label:"Push to Talk",type:"radio",checked:mode==="push",click:()=>setMicMode("push")},
  {label:"Mic Off",type:"radio",checked:mode==="off",click:()=>setMicMode("off")},
  {type:"separator"},
  {label:"Check for Updates",click:()=>checkForUpdates({showDialog:true}).catch(e=>dialog.showErrorBox("Saeed AI Updates",e.message))},
  {label:"Settings",click:showSettings},
  {label:"Close Saeed",click:()=>app.quit()}
 ]));
}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"فتح المحادثة",click:showChat},
  {label:"Hide Saeed",click:hideCharacter},
  {type:"separator"},
  {label:"Capture Screen",click:async()=>{const image=await captureScreen();showChat();win?.webContents.send("screen:capture",image)}},
  {label:"Settings",click:showSettings},
  {type:"separator"},
  {label:"خروج",click:()=>app.quit()}
 ]);
 menu.popup({window:win});
}
async function createWindow(){
 win=new BrowserWindow({
  name:"saeed-main",
  icon:path.join(__dirname,"..","assets","saeed.png"),
  title:"Saeed AI — Chat",
  width:WINDOW.width,height:WINDOW.height,minWidth:WINDOW.minWidth,minHeight:WINDOW.minHeight,
  frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:true,skipTaskbar:false,
  webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}
 });
 win.setIcon(path.join(__dirname,"..","assets","saeed.png"));
 if(process.platform==="win32")win.setAppDetails({appId:"ai.saeed.desktop",appIconPath:path.join(__dirname,"..","assets","saeed.png"),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI"});
 win.setAlwaysOnTop(true,"floating");
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData")});
  registry.confirm=({name,args})=>new Promise(resolve=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);confirmations.set(id,resolve);showChat();win?.webContents.send("agent:confirm",{id,name,args});});
 agent=new Agent({registry,onEvent:e=>win?.webContents.send("agent:event",e)});
  registry.setPermissions(agent.settings.permissions);
 win.on("close",e=>{if(!app.isQuitting){e.preventDefault();win.hide()}});\n win.on("closed",()=>{win=null});
 win.webContents.on("context-menu",()=>contextMenu(win));
 win.on("move",keepWindowVisible);
 await win.loadFile(path.join(__dirname,"chat.html"));
 placeBottomRight();
 win.show();
}
app.whenReady().then(async()=>{
 app.setAppUserModelId("ai.saeed.desktop");
 try{await createWindow()}catch(e){console.error("Saeed startup failed:",e);app.quit();return}
 try{
  tray=new Tray(trayIcon());
  tray.setToolTip("Saeed AI");
  rebuildTrayMenu();
 }catch(e){console.error("Tray failed:",e)}
 globalShortcut.register("CommandOrControl+Shift+M",showChat);
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{const image=await captureScreen();showChat();win?.webContents.send("screen:capture",image)}
  catch(e){console.error("Screen capture failed:",e)}
 });
 const refresh=()=>{if(win)fitWindowToDisplay(displayForWindow())};
 screen.on("display-added",refresh);
 screen.on("display-removed",()=>{if(win)keepWindowVisible()});
 screen.on("display-metrics-changed",refresh);
});
ipcMain.handle("chat",(_,payload)=>{
 if(!agent)return {ok:false,error:"Saeed is still starting."};
 const data=typeof payload==="string"?{text:payload}:payload||{};
 return agent.run(String(data.text||""),data.image||null);
});
ipcMain.handle("settings:get",()=>agent?.publicSettings()||null);
ipcMain.handle("settings:set",(_,s)=>{
 if(!agent)throw new Error("Saeed is still starting.");
 agent.settings={...(s||{})};
 agent.registry.setPermissions(agent.settings.permissions);
 const mode=agent.settings.micMode||"always";
 if(mode==="off") stopRealtime(); else startRealtime();
 rebuildTrayMenu();
 return agent.publicSettings();
});
ipcMain.handle("realtime:start",(_,options={})=>{startRealtime(options);return true});
ipcMain.handle("realtime:stop",()=>{stopRealtime();return true});
ipcMain.handle("realtime:audio",(_,base64)=>{realtime?.appendAudio(String(base64||""));return true});
ipcMain.handle("realtime:text",(_,text)=>{const t=String(text||"");agent?.registry.setRequestIntent(/(screen|screenshot|capture|desktop|window|mouse|keyboard|type|click|press|open|close|launch|start|focus|move|computer|pc|file|folder|application|app|settings|شاشة|سكرين|لقطة|صورة الشاشة|نافذة|ماوس|فأرة|كيبورد|اكتب|اضغط|انقر|افتح|اغلق|أغلق|شغل|شغّل|حرك|ملف|مجلد|تطبيق|حاسوب|كمبيوتر|إعدادات)/i.test(t),t);return realtime?.text(t)||false});
ipcMain.handle("realtime:cancel",()=>{realtime?.cancel();return true});
ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{const resolve=confirmations.get(id);if(!resolve)return false;confirmations.delete(id);resolve(Boolean(approved));return true;});
ipcMain.handle("history:get",()=>agent?{activeId:agent.activeConversationId,conversations:agent.listConversations(),messages:agent.history}:null);
ipcMain.handle("history:new",()=>{if(!agent)return false;agent.newConversation();win?.webContents.send("history:changed",{activeId:agent.activeConversationId,conversations:agent.listConversations(),messages:agent.history});return true});
ipcMain.handle("history:open",(_,id)=>{if(!agent||!agent.openConversation(id))return false;win?.webContents.send("history:changed",{activeId:agent.activeConversationId,conversations:agent.listConversations(),messages:agent.history});return true});
ipcMain.handle("history:clear",()=>{if(!agent)return false;agent.newConversation();win?.webContents.send("history:changed",{activeId:agent.activeConversationId,conversations:agent.listConversations(),messages:agent.history});return true});\nipcMain.handle("history:delete",()=>{if(!agent)return false;const ok=agent.deleteConversation(agent.activeConversationId);if(ok)win?.webContents.send("history:changed",{activeId:agent.activeConversationId,conversations:agent.listConversations(),messages:agent.history});return ok});

function stopRealtime(){
 if(realtime){realtime.stop();realtime=null}
 win?.webContents.send("realtime:state","disconnected");
}
function startRealtime(options={}){
 const s=agent?.settings||{};
 const key=s.realtimeApiKey||s.apiKey||"";
 if(!key || s.provider==="ollama"){win?.webContents.send("realtime:state","not-configured","OpenAI API key is not configured.");return false}
 if(realtime) realtime.stop();
 const registry=agent?.registry;
 const realtimeTools=(registry?.schemas?.()||[]).map(t=>({
  type:"function",
  name:t.function?.name,
  description:t.function?.description||"",
  parameters:t.function?.parameters||{type:"object",properties:{},required:[]}
 })).filter(t=>t.name);
 const {OpenAIRealtime}=require("./realtime");
 realtime=new OpenAIRealtime({
  state:(state,message)=>win?.webContents.send("realtime:state",state,message),
  event:async(event)=>{
   if(event.type==="response.output_audio.delta"&&event.delta)win?.webContents.send("realtime:audio",event.delta);
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta)win?.webContents.send("realtime:assistant-delta",event.delta);
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript)win?.webContents.send("realtime:assistant-final",event.transcript);
   else if(event.type==="conversation.item.input_audio_transcription.delta"&&event.delta)win?.webContents.send("realtime:user-delta",event.delta);
   else if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript){agent?.registry.setRequestIntent(/(screen|screenshot|capture|desktop|window|mouse|keyboard|type|click|press|open|close|launch|start|focus|move|computer|pc|file|folder|application|app|settings|شاشة|سكرين|لقطة|صورة الشاشة|نافذة|ماوس|فأرة|كيبورد|اكتب|اضغط|انقر|افتح|اغلق|أغلق|شغل|شغّل|حرك|ملف|مجلد|تطبيق|حاسوب|كمبيوتر|إعدادات)/i.test(String(event.transcript)),String(event.transcript));win?.webContents.send("realtime:user-final",event.transcript);}
   else if(event.type==="response.function_call_arguments.done"&&event.call_id){
    const name=String(event.name||"");
    let args={};
    try{args=JSON.parse(event.arguments||"{}")}catch{args={}};
    win?.webContents.send("agent:event",{type:"tool",name,args,source:"realtime"});
    let out;
    try{out=await registry.call(name,args)}catch(e){out={ok:false,error:e.message}};
    if(out?.ok===false)win?.webContents.send("agent:event",{type:"tool_error",name,error:out.error||"Tool failed",source:"realtime"});
    else win?.webContents.send("agent:event",{type:"tool_result",name,result:out,source:"realtime"});
    realtime?.toolResult(event.call_id,out||{ok:false,error:"Tool returned no result"});
   }
   else if(event.type==="response.done")win?.webContents.send("realtime:done",event.response?.status||"completed");
   else if(event.type==="error")win?.webContents.send("realtime:error",event.error?.message||"Realtime API error");
  }
 });
 realtime.start(key,{model:s.realtimeModel||"gpt-realtime-2.1",voice:s.realtimeVoice||"marin",tools:realtimeTools});
 return true;
}
ipcMain.on("window:move-by",(_,dx,dy)=>{
 if(!win)return;
 const [x,y]=win.getPosition(),[w,h]=win.getSize();
 const nextX=x+Math.round(Number(dx)||0),nextY=y+Math.round(Number(dy)||0);
 const center={x:nextX+w/2,y:nextY+h/2};
 const d=screen.getDisplayNearestPoint(center)||screen.getPrimaryDisplay();
 const a=d.workArea;
 const nx=Math.max(a.x,Math.min(nextX,a.x+Math.max(0,a.width-w)));
 const ny=Math.max(a.y,Math.min(nextY,a.y+Math.max(0,a.height-h)));
 win.setPosition(nx,ny,true);
});
ipcMain.on("window:show-chat",showChat);\nipcMain.on("character:ready",()=>{if(!characterWelcomed){characterWelcomed=true;speakWelcome()}});
ipcMain.on("window:open-settings",showSettings);
ipcMain.on("window:minimize",()=>win?.minimize());
ipcMain.on("window:hide",()=>win?.hide());
ipcMain.on("app:quit",()=>app.quit());
ipcMain.on("settings:close",()=>settingsWin?.close());
ipcMain.handle("updates:check",()=>checkForUpdates());
ipcMain.handle("updates:install",(_,info)=>installUpdate(info));
app.on("activate",()=>{showCharacter()});
app.on("window-all-closed",()=>{});
app.on("before-quit",()=>{app.isQuitting=true;try{stopRealtime()}catch{};try{characterWin?.destroy()}catch{};try{win?.destroy()}catch{};try{settingsWin?.destroy()}catch{};try{tray?.destroy()}catch{}});
app.on("will-quit",()=>globalShortcut.unregisterAll());