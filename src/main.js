const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer}=require("electron");
const path=require("path"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools");
let win,agent;
async function captureScreen(){const s=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});return s[0]?.thumbnail.toDataURL()||null}
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:620,height:800,frame:false,transparent:true,alwaysOnTop:true,show:true,webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}});
 win.setAlwaysOnTop(true,"floating");win.loadFile(path.join(__dirname,"index.html"));
 const registry=new ToolRegistry({captureScreen});agent=new Agent({registry,onEvent:e=>win.webContents.send("agent:event",e)});
 globalShortcut.register("CommandOrControl+Shift+M",()=>{win.show();win.focus()});
});
ipcMain.handle("chat",(_,text)=>agent.run(text));
ipcMain.handle("settings:get",()=>agent.settings);
ipcMain.handle("settings:set",(_,s)=>agent.settings={...agent.settings,...s});
ipcMain.handle("capture",()=>captureScreen());
app.on("window-all-closed",e=>e.preventDefault());
app.on("will-quit",()=>globalShortcut.unregisterAll());