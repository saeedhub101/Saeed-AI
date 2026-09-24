const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("saeed",{
 chat:(text,image=null)=>ipcRenderer.invoke("chat",{text,image}),
 capture:()=>ipcRenderer.invoke("capture"),
 getHistory:()=>ipcRenderer.invoke("history:get"),
 getSettings:()=>ipcRenderer.invoke("settings:get"),
 setSettings:s=>ipcRenderer.invoke("settings:set",s),
 moveWindowBy:(dx,dy)=>ipcRenderer.send("window:move-by",dx,dy),
 showChat:()=>ipcRenderer.send("window:show-chat"),hideChat:()=>ipcRenderer.send("window:hide-chat"),setIgnoreMouseEvents:ignore=>ipcRenderer.send("window:set-ignore-mouse-events",Boolean(ignore)),
 onEvent:f=>ipcRenderer.on("agent:event",(_,e)=>f(e)),
 onConfirmation:f=>ipcRenderer.on("agent:confirm",(_,e)=>f(e)),
 respondConfirmation:(id,approved)=>ipcRenderer.invoke("agent:confirm-response",id,approved),
 onScreenCapture:f=>ipcRenderer.on("screen:capture",(_,e)=>f(e)),
 onShowChat:f=>ipcRenderer.on("chat:show",()=>f()),
 onShowSettings:f=>ipcRenderer.on("settings:show",()=>f())
});