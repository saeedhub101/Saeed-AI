const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const modes = [
  ["4","Three.js + WebGL","three-webgl"],
  ["5","Three.js + WebGPU","three-webgpu"],
  ["6","Electron + Chromium (WebGL)","electron"],
  ["7","Reserved / Blank","blank"]
];

let nativeProcess = null;

function createWindow(index,title,mode,x,y){
  const win = new BrowserWindow({
    width:520,height:760,minWidth:360,minHeight:480,
    title:"Saeed Render Lab — "+index+" — "+title,
    backgroundColor:"#101318",
    webPreferences:{contextIsolation:true,sandbox:true,webSecurity:true}
  });
  win.loadFile(path.join(__dirname,"index.html"),{query:{index,title,mode,glb:"saeed.ai.glb"}});
  win.setPosition(x,y);
}

app.whenReady().then(()=>{
  const resourcesRoot=process.resourcesPath;
  const nativeExe=path.join(resourcesRoot,"native","saeed_renderer_lab_native.exe");
  nativeProcess=spawn(nativeExe,[],{cwd:resourcesRoot,windowsHide:false});
  nativeProcess.on("error",e=>console.error("Native renderer lab:",e));
  nativeProcess.on("exit",(code,signal)=>console.log("Native renderer lab exited",code,signal));
  modes.forEach(([i,t,m],n)=>createWindow(i,t,m,40+n*520,40));
});
app.on("before-quit",()=>{if(nativeProcess && !nativeProcess.killed)nativeProcess.kill();});
app.on("window-all-closed",()=>app.quit());