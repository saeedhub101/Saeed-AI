const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("saeed",{
 chat:(text,image=null)=>ipcRenderer.invoke("chat",{text,image}),
 capture:()=>ipcRenderer.invoke("capture"),
 getSettings:()=>ipcRenderer.invoke("settings:get"),
 setSettings:s=>ipcRenderer.invoke("settings:set",s),
 moveWindowBy:(dx,dy)=>ipcRenderer.send("window:move-by",dx,dy),
 showChat:()=>ipcRenderer.send("window:show-chat"),
 onEvent:f=>ipcRenderer.on("agent:event",(_,e)=>f(e)),
 onScreenCapture:f=>ipcRenderer.on("screen:capture",(_,e)=>f(e)),
 onShowChat:f=>ipcRenderer.on("chat:show",()=>f()),
 onShowSettings:f=>ipcRenderer.on("settings:show",()=>f())
});