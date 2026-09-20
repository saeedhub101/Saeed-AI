const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu}=require("electron");
const path=require("path"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));

let win,agent,tray;

async function captureScreen(){
 const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});
 return sources[0]?.thumbnail.toDataURL()||null;
}

async function createWindow(){
 win=new BrowserWindow({
  width:620,height:800,frame:false,transparent:true,alwaysOnTop:true,show:true,
  webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}
 });
 win.setAlwaysOnTop(true,"floating");
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData")});
 agent=new Agent({registry,onEvent:e=>win?.webContents.send("agent:event",e)});
 win.on("closed",()=>{win=null});
 await win.loadFile(path.join(__dirname,"index.html"));
}

app.whenReady().then(async()=>{
 try{await createWindow()}catch(e){console.error("Saeed startup failed:",e);app.quit();return}

 try{
  tray=new Tray(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64"));
  const menu=Menu.buildFromTemplate([
   {label:"Show Saeed",click:()=>{win?.show();win?.focus()}},
   {label:"Hide Saeed",click:()=>win?.hide()},
   {type:"separator"},
   {label:"Quit",click:()=>app.quit()}
  ]);
  tray.setToolTip("Saeed AI");tray.setContextMenu(menu);
 }catch(e){console.error("Tray failed:",e)}

 globalShortcut.register("CommandOrControl+Shift+M",()=>{win?.show();win?.focus()});
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{
   const image=await captureScreen();
   win?.webContents.send("screen:capture",image);
   win?.show();win?.focus();
  }catch(e){console.error("Screen capture failed:",e)}
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

app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow().catch(e=>console.error(e))});
app.on("window-all-closed",e=>e.preventDefault());
app.on("will-quit",()=>globalShortcut.unregisterAll());