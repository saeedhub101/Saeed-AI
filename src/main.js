const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage}=require("electron");
const path=require("path"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools"),{OpenAIRealtime}=require("./realtime");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));

let win,settingsWin,agent,tray,realtime;
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
function showChat(){keepWindowVisible();win?.show();win?.focus();win?.webContents.send("chat:show")}
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

async function checkForUpdates(){
 return new Promise((resolve,reject)=>{
  const https=require("https");
  const req=https.get("https://api.github.com/repos/saeedhub101/Saeed-AI/releases/latest",{headers:{"User-Agent":"Saeed-AI","Accept":"application/vnd.github+json"}},res=>{
   let body="";res.setEncoding("utf8");res.on("data",d=>body+=d);res.on("end",async()=>{
    try{if(res.statusCode!==200)throw new Error("GitHub returned HTTP "+res.statusCode);const r=JSON.parse(body);const latest=String(r.tag_name||"").replace(/^v/i,"");const current=app.getVersion();const newer=latest&&latest!==current;const text=newer?"A new Saeed AI release is available: v"+latest:"Saeed AI is up to date (v"+current+").";await dialog.showMessageBox(settingsWin||win,{type:newer?"info":"info",title:"Saeed AI Updates",message:text,detail:newer?(r.html_url||"Open GitHub Releases to review the new version."):undefined});resolve(text)}catch(e){reject(e)}
   });
  });req.on("error",reject);req.setTimeout(8000,()=>{req.destroy(new Error("Update check timed out"))});
 });
}
function trayIcon(){
 const png="iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABuk";
 return nativeImage.createFromDataURL("data:image/png;base64,"+png);
}
function rebuildTrayMenu(){
 if(!tray||!agent)return;
 const mode=agent.settings?.micMode||"off";
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:"Show Chat",click:showChat},
  {type:"separator"},
  {label:"Always Listening",type:"radio",checked:mode==="always",click:()=>setMicMode("always")},
  {label:"Push to Talk",type:"radio",checked:mode==="push",click:()=>setMicMode("push")},
  {label:"Mic Off",type:"radio",checked:mode==="off",click:()=>setMicMode("off")},
  {type:"separator"},
  {label:"Check for Updates",click:()=>checkForUpdates().catch(e=>dialog.showErrorBox("Saeed AI Updates",e.message))},
  {label:"Settings",click:showSettings},
  {label:"Close Saeed",click:()=>app.quit()}
 ]));
}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"فتح المحادثة",click:showChat},
  {label:"إخفاء Saeed",click:()=>win?.hide()},
  {type:"separator"},
  {label:"التقاط الشاشة",click:async()=>{const image=await captureScreen();showChat();win?.webContents.send("screen:capture",image)}},
  {label:"الإعدادات…",click:showSettings},
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
 win.setAlwaysOnTop(true,"floating");
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData")});
  registry.confirm=({name,args})=>new Promise(resolve=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);confirmations.set(id,resolve);showChat();win?.webContents.send("agent:confirm",{id,name,args});});
 agent=new Agent({registry,onEvent:e=>win?.webContents.send("agent:event",e)});
  registry.setPermissions(agent.settings.permissions);
 win.on("closed",()=>{win=null});
 win.webContents.on("context-menu",()=>contextMenu());
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
ipcMain.handle("realtime:text",(_,text)=>realtime?.text(String(text||""))||false);
ipcMain.handle("realtime:cancel",()=>{realtime?.cancel();return true});
ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{const resolve=confirmations.get(id);if(!resolve)return false;confirmations.delete(id);resolve(Boolean(approved));return true;});
ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("history:clear",()=>{if(!agent)return false;agent.history=[];agent.saveHistory();win?.webContents.send("history:cleared");return true;});

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
 realtime=new OpenAIRealtime({
  state:(state,message)=>win?.webContents.send("realtime:state",state,message),
  event:async(event)=>{
   if(event.type==="response.output_audio.delta"&&event.delta)win?.webContents.send("realtime:audio",event.delta);
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta)win?.webContents.send("realtime:assistant-delta",event.delta);
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript)win?.webContents.send("realtime:assistant-final",event.transcript);
   else if(event.type==="conversation.item.input_audio_transcription.delta"&&event.delta)win?.webContents.send("realtime:user-delta",event.delta);
   else if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript)win?.webContents.send("realtime:user-final",event.transcript);
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
ipcMain.on("window:show-chat",showChat);
ipcMain.on("window:open-settings",showSettings);
ipcMain.on("window:minimize",()=>win?.minimize());
ipcMain.on("window:hide",()=>win?.hide());
ipcMain.on("settings:close",()=>settingsWin?.close());
ipcMain.handle("updates:check",()=>checkForUpdates());
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow().catch(e=>console.error(e))});
app.on("window-all-closed",()=>app.quit());
app.on("before-quit",()=>{try{stopRealtime()}catch{};try{tray?.destroy()}catch{}});
app.on("will-quit",()=>globalShortcut.unregisterAll());