const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu}=require("electron");
const path=require("path"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");
process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));
let win,agent,tray;
async function captureScreen(){const s=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});return s[0]?.thumbnail.toDataURL()||null}
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:620,height:800,frame:false,transparent:true,alwaysOnTop:true,show:true,webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}});
 win.setAlwaysOnTop(true,"floating");win.loadFile(path.join(__dirname,"index.html"));
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData")});
 agent=new Agent({registry,onEvent:e=>win.webContents.send("agent:event",e)});
 tray=new Tray(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64"));
 const menu=Menu.buildFromTemplate([{label:"Show Saeed",click:()=>{win.show();win.focus()}},{label:"Hide Saeed",click:()=>win.hide()},{type:"separator"},{label:"Quit",click:()=>app.quit()}]);tray.setToolTip("Saeed AI");tray.setContextMenu(menu);
 globalShortcut.register("CommandOrControl+Shift+M",()=>{win.show();win.focus()});
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{const image=await captureScreen();win.webContents.send("screen:capture",image);win.show();win.focus()});
});
ipcMain.handle("chat",(_,text)=>agent.run(text));
ipcMain.handle("settings:get",()=>agent.settings);
ipcMain.handle("settings:set",(_,s)=>{agent.settings=s;return agent.settings});
ipcMain.handle("capture",()=>captureScreen());
app.on("window-all-closed",e=>e.preventDefault());
app.on("will-quit",()=>globalShortcut.unregisterAll());