const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen}=require("electron");
const path=require("path"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));

let win,agent,tray;
const WINDOW={width:760,height:520};

async function captureScreen(){
 const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});
 return sources[0]?.thumbnail.toDataURL()||null;
}
function placeBottomRight(){
 if(!win)return;
 const display=screen.getPrimaryDisplay(),area=display.workArea;
 win.setPosition(Math.max(area.x,area.x+area.width-WINDOW.width-18),Math.max(area.y,area.y+area.height-WINDOW.height-18),true);
}
function showChat(){win?.show();win?.focus();win?.webContents.send("chat:show")}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"فتح المحادثة",click:showChat},
  {label:"إخفاء Saeed",click:()=>win?.hide()},
  {type:"separator"},
  {label:"التقاط الشاشة",click:async()=>{const image=await captureScreen();win?.show();win?.webContents.send("screen:capture",image)}},
  {label:"الإعدادات…",click:()=>{win?.show();win?.webContents.send("settings:show")}},
  {type:"separator"},
  {label:"خروج",click:()=>app.quit()}
 ]);
 menu.popup({window:win});
}
async function createWindow(){
 win=new BrowserWindow({
  width:WINDOW.width,height:WINDOW.height,frame:false,transparent:true,alwaysOnTop:true,show:false,
  hasShadow:false,resizable:false,skipTaskbar:true,
  webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}
 });
 win.setAlwaysOnTop(true,"floating");
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData")});
 agent=new Agent({registry,onEvent:e=>win?.webContents.send("agent:event",e)});
 win.on("closed",()=>{win=null});
 win.webContents.on("context-menu",()=>contextMenu());
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
   {type:"separator"},{label:"Quit",click:()=>app.quit()}
  ]));
 }catch(e){console.error("Tray failed:",e)}
 globalShortcut.register("CommandOrControl+Shift+M",showChat);
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{const image=await captureScreen();win?.show();win?.focus();win?.webContents.send("screen:capture",image)}
  catch(e){console.error("Screen capture failed:",e)}
 });
});
ipcMain.handle("chat",(_,payload)=>{
 if(!agent)return {ok:false,error:"Saeed is still starting."};
 const data=typeof payload==="string"?{text:payload}:payload||{};
 return agent.run(String(data.text||""),data.image||null);
});
ipcMain.handle("settings:get",()=>agent?.publicSettings()||null);
ipcMain.handle("settings:set",(_,s)=>{if(!agent)throw new Error("Saeed is still starting.");agent.settings=s||{};return agent.publicSettings()});
ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.on("window:move-by",(_,dx,dy)=>{
 if(!win)return;const [x,y]=win.getPosition();const d=screen.getDisplayNearestPoint({x,y});const a=d.workArea;
 win.setPosition(Math.max(a.x,Math.min(x+Math.round(dx),a.x+a.width-WINDOW.width)),Math.max(a.y,Math.min(y+Math.round(dy),a.y+a.height-WINDOW.height)),true);
});
ipcMain.on("window:show-chat",showChat);
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow().catch(e=>console.error(e))});
app.on("window-all-closed",e=>e.preventDefault());
app.on("will-quit",()=>globalShortcut.unregisterAll());