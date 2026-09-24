const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,Notification}=require("electron");
const path=require("path"),fs=require("fs"),https=require("https"),{spawn}=require("child_process"),{nativeImage,shell}=require("electron"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));

let win,agent,tray,quitting=false;
app.setAppUserModelId("ai.saeed.desktop");
const gotSingleInstanceLock=app.requestSingleInstanceLock();
if(!gotSingleInstanceLock){app.quit();return;}
app.on("second-instance",()=>{if(win){win.show();win.focus();showChat();}});
let notificationCount=0;const notifications=[];
const confirmations=new Map();
const WINDOW={avatarWidth:340,avatarHeight:540,chatWidth:820,chatHeight:560,minWidth:300,minHeight:300};
let chatOpen=false;

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
function currentWindowSize(){return chatOpen?{width:WINDOW.chatWidth,height:WINDOW.chatHeight}:{width:WINDOW.avatarWidth,height:WINDOW.avatarHeight};}
function fitWindowToDisplay(display=displayForWindow(),{bottomRight=false}={}){
 const target=currentWindowSize();
 if(!win)return;
 const area=display.workArea;
 const width=Math.min(target.width,Math.max(WINDOW.minWidth,area.width));
 const height=Math.min(target.height,Math.max(WINDOW.minHeight,area.height));
 if(win.getSize()[0]!==width||win.getSize()[1]!==height)win.setSize(width,height,false);
 const margin=18;
 const [x0,y0]=win.getPosition();
 const x=bottomRight?area.x+Math.max(0,area.width-width-margin):Math.max(area.x,Math.min(x0,area.x+Math.max(0,area.width-width)));
 const y=bottomRight?area.y+Math.max(0,area.height-height-margin):Math.max(area.y,Math.min(y0,area.y+Math.max(0,area.height-height)));
 win.setPosition(Math.round(x),Math.round(y),false);
}
function placeBottomRight(){
 if(!win)return;
 fitWindowToDisplay(screen.getPrimaryDisplay(),{bottomRight:true});
}
function keepWindowVisible(){
 if(!win)return;
 const display=displayForWindow();
 fitWindowToDisplay(display);
}
function setChatMode(open){chatOpen=Boolean(open);if(win){fitWindowToDisplay(displayForWindow());win.setIgnoreMouseEvents(!chatOpen,{forward:true});}}
function showChat(){setChatMode(true);win?.show();win?.focus();win?.webContents.send("chat:show")}
function hideChat(){setChatMode(false);win?.show();win?.webContents.send("chat:hide")}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"Chat",click:showChat},
  {label:"Check for updates",click:checkForUpdates},
  {label:`Notifications${notificationCount?` (${notificationCount})`:""}`,click:()=>{showChat();win?.webContents.send("notifications:list",notifications.slice())}},
  {label:"Mute",type:"checkbox",checked:false,click:item=>win?.webContents.send("voice:mute",item.checked)},
  {label:"Close microphone",click:()=>win?.webContents.send("voice:mic",false)},
  {label:"Open microphone",click:()=>win?.webContents.send("voice:mic",true)},
  {type:"separator"},{label:"Exit",click:()=>app.quit()}
 ]);menu.popup({window:win});
}
async function pushNotification(title,body,type="info"){
 const item={id:Date.now().toString(),title:String(title),body:String(body),type,created:new Date().toISOString()};notifications.unshift(item);notificationCount=notifications.length;win?.webContents.send("notification:new",item);tray?.setToolTip(`Saeed AI${notificationCount?` • ${notificationCount} notification${notificationCount===1?"":"s"}`:""}`);
 try{if(Notification.isSupported())new Notification({title:"Saeed AI — "+item.title,body:item.body,silent:false}).show()}catch{}
}
function versionParts(v){return String(v||"0").replace(/^v/i,"").split(/[.+-]/)[0].split(".").map(n=>Number.isFinite(Number(n))?Number(n):0)}
function compareVersions(a,b){const A=versionParts(a),B=versionParts(b);for(let i=0;i<3;i++){if((A[i]||0)!==(B[i]||0))return (A[i]||0)>(B[i]||0)?1:-1}return 0}
async function getLatestRelease(){
 const r=await fetch("https://api.github.com/repos/saeedhub101/Saeed-AI/releases/latest",{headers:{"User-Agent":"Saeed-AI"}});
 if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub ${r.status}`);return r.json();
}
async function checkForUpdates(){
 try{
  const release=await getLatestRelease();if(!release){await pushNotification("Updates","No published release is available yet.","update");return {ok:true,available:false}};
  const current=app.getVersion(),latest=String(release.tag_name||"").replace(/^v/i,""),updateAvailable=Boolean(latest&&compareVersions(latest,current)>0);
  if(updateAvailable)await pushNotification("Update available",`Saeed AI ${latest} is available (current ${current}).`,"update");else await pushNotification("Updates",`Saeed AI is up to date (current ${current}).`,"update");
  return {ok:true,current,latest,updateAvailable,releaseUrl:release.html_url||"",body:release.body||""};
 }catch(e){await pushNotification("Update check failed",e.message,"error");return {ok:false,error:e.message}}
}
function sendUpdateProgress(stage,percent,message){win?.webContents.send("update:progress",{stage,percent,message});}
async function downloadUpdate(){
 const release=await getLatestRelease();const current=app.getVersion(),latest=String(release?.tag_name||"").replace(/^v/i,"");
 if(!latest||compareVersions(latest,current)<=0)throw new Error("No newer Saeed AI release is available.");
 const asset=(release.assets||[]).find(a=>/^Saeed-AI-Setup-x64\.exe$/i.test(a.name));if(!asset)throw new Error("The latest release does not contain the Windows installer.");
 const target=path.join(app.getPath("temp"),"Saeed-AI-Setup-x64-v"+latest+".exe");sendUpdateProgress("preparing",2,"Preparing the update…");
 const download=(url,redirects=0)=>new Promise((resolve,reject)=>{
  if(redirects>5)return reject(new Error("Too many download redirects."));
  let file=null;
  https.get(url,{headers:{"User-Agent":"Saeed-AI"}},res=>{
   if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();return download(res.headers.location,redirects+1).then(resolve,reject)}
   if(res.statusCode!==200){res.resume();if(file)file.close();return reject(new Error("Download failed: HTTP "+res.statusCode))}
   const total=Number(res.headers["content-length"]||asset.size||0);let done=0;file=fs.createWriteStream(target);
   res.on("data",chunk=>{done+=chunk.length;const pct=total?Math.round(done/total*100):50;sendUpdateProgress("downloading",Math.max(3,pct),total?"Downloading update… "+Math.round(done/1048576)+" / "+Math.round(total/1048576)+" MB":"Downloading update…")});
   res.pipe(file);file.on("finish",()=>file.close(resolve));res.on("error",e=>{file.close();fs.unlink(target,()=>{});reject(e)});file.on("error",e=>{fs.unlink(target,()=>{});reject(e)});
  }).on("error",e=>{if(file)file.close();fs.unlink(target,()=>{});reject(e)});
 });
 await download(asset.browser_download_url);sendUpdateProgress("ready",100,"Update downloaded. Starting installer…");
 const child=spawn(target,[],{detached:true,stdio:"ignore",windowsHide:false});child.unref();setTimeout(()=>app.quit(),700);return {ok:true,version:latest,path:target};
}
async function createWindow(){
 win=new BrowserWindow({
  name:"saeed-main",
  width:WINDOW.avatarWidth,height:WINDOW.avatarHeight,minWidth:WINDOW.minWidth,minHeight:WINDOW.minHeight,
  frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:false,skipTaskbar:false,icon:path.join(__dirname,"..","Saeed.ico"),
  webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}
 });
 win.setAlwaysOnTop(true,"floating");
 const registry=new ToolRegistry({
  captureScreen,userDataPath:app.getPath("userData"),
  confirm:({name,args})=>new Promise(resolve=>{
   const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
   confirmations.set(id,resolve);showChat();win?.webContents.send("agent:confirm",{id,name,args});
  })
 });
 agent=new Agent({registry,onEvent:e=>win?.webContents.send("agent:event",e)});
 win.on("closed",()=>{win=null});
 win.webContents.on("context-menu",()=>contextMenu());
 win.on("move",keepWindowVisible);
 await win.loadFile(path.join(__dirname,"index.html"));
 placeBottomRight();
 win.show();
}
app.whenReady().then(async()=>{
 try{await createWindow()}catch(e){console.error("Saeed startup failed:",e);app.quit();return}
 try{
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,"..","Saeed.ico")));
  tray.setToolTip("Saeed AI");
  tray.setContextMenu(Menu.buildFromTemplate([
   {label:"Show Saeed",click:showChat},{label:"Hide Saeed",click:()=>win?.hide()},
   {label:"Check for updates",click:checkForUpdates},
   {label:`Notifications${notificationCount?` (${notificationCount})`:""}`,click:()=>{showChat();win?.webContents.send("notifications:list",notifications.slice())}},
   {type:"separator"},{label:"Quit",click:()=>app.quit()}
  ]));
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
ipcMain.handle("updates:check",()=>checkForUpdates());
ipcMain.handle("updates:install",()=>downloadUpdate());
ipcMain.handle("ai:get-settings",()=>agent?.publicSettings()||{});
ipcMain.handle("ai:get-providers",()=>agent?.providerCatalog()||[]);
ipcMain.handle("ai:save-settings",(_,settings)=>{if(!agent)return {ok:false,error:"Saeed is still starting."};try{agent.settings=settings;return {ok:true,settings:agent.publicSettings()}}catch(e){return {ok:false,error:e.message}}});
ipcMain.handle("ai:open-provider",(_,url)=>{if(!/^https:\/\//i.test(String(url||"")))return false;return shell.openExternal(String(url)).then(()=>true).catch(()=>false)});
ipcMain.on("app:exit",()=>app.quit());
ipcMain.handle("notifications:get",()=>notifications.slice());
ipcMain.handle("notifications:clear",()=>{notificationCount=0;notifications.length=0;tray?.setToolTip("Saeed AI");return true});
ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{
 const resolve=confirmations.get(id);if(!resolve)return false;
 confirmations.delete(id);resolve(Boolean(approved));return true;
});
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
ipcMain.on("window:hide-chat",hideChat);
ipcMain.on("window:set-ignore-mouse-events",(_,ignore)=>{if(win&&!chatOpen)win.setIgnoreMouseEvents(Boolean(ignore),{forward:true})});
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow().catch(e=>console.error(e))});
app.on("before-quit",()=>{quitting=true;try{globalShortcut.unregisterAll()}catch{}try{tray?.destroy()}catch{};try{if(win&&!win.isDestroyed())win.destroy()}catch{}});
app.on("will-quit",()=>{try{globalShortcut.unregisterAll()}catch{};try{tray?.destroy()}catch{}});