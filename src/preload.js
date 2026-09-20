const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("saeed",{
 chat:(text,image=null)=>ipcRenderer.invoke("chat",{text,image}),
 capture:()=>ipcRenderer.invoke("capture"),
 getSettings:()=>ipcRenderer.invoke("settings:get"),
 setSettings:s=>ipcRenderer.invoke("settings:set",s),
 onEvent:f=>ipcRenderer.on("agent:event",(_,e)=>f(e)),
 onScreenCapture:f=>ipcRenderer.on("screen:capture",(_,e)=>f(e))
});