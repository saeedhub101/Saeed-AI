const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,Notification}=require("electron");
const path=require("path"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));

let win,agent,tray;
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
async function checkForUpdates(){
 try{const r=await fetch("https://api.github.com/repos/saeedhub101/Saeed-AI/releases/latest",{headers:{"User-Agent":"Saeed-AI"}});if(r.status===404){await pushNotification("Updates","No published release is available yet.","update");return {ok:true,available:false}}if(!r.ok)throw new Error(`GitHub ${r.status}`);const release=await r.json();const current=app.getVersion();const latest=String(release.tag_name||"").replace(/^v/i,"");if(latest&&latest!==current)await pushNotification("Update available",`Saeed AI ${latest} is available (current ${current}).`,"update");else await pushNotification("Updates","Saeed AI is up to date.","update");return {ok:true,current,latest}}
 catch(e){await pushNotification("Update check failed",e.message,"error");return {ok:false,error:e.message}}
}
async function createWindow(){
 win=new BrowserWindow({
  name:"saeed-main",
  width:WINDOW.avatarWidth,height:WINDOW.avatarHeight,minWidth:WINDOW.minWidth,minHeight:WINDOW.minHeight,
  frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:false,skipTaskbar:true,
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
  tray=new Tray(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64"));
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
app.on("window-all-closed",e=>e.preventDefault());
app.on("will-quit",()=>globalShortcut.unregisterAll());