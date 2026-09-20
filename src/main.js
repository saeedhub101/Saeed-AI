const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer}=require("electron");
const path=require("path");
const {Agent}=require("./agent");
const {ToolRegistry}=require("./tools");
let win,agent;
app.whenReady().then(()=>{
 win=new BrowserWindow({width:560,height:760,frame:false,transparent:true,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}});
 win.setAlwaysOnTop(true,"floating");
 win.loadFile(path.join(__dirname,"index.html"));
 const registry=new ToolRegistry();
 agent=new Agent({registry,onEvent:e=>win.webContents.send("agent:event",e)});
 globalShortcut.register("CommandOrControl+Shift+M",()=>win.show());
});
ipcMain.handle("chat",(_,text)=>agent.run(text));
ipcMain.handle("settings:get",()=>agent.settings);
ipcMain.handle("settings:set",(_,s)=>agent.settings={...agent.settings,...s});
ipcMain.handle("capture",async()=>{const s=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1600,height:1000}});return s[0]?.thumbnail.toDataURL()});
app.on("will-quit",()=>globalShortcut.unregisterAll());