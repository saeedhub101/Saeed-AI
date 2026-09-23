const { app, BrowserWindow } = require("electron");
const path = require("path");
const modes = [
  ["1","DirectX 11","native-dx11"],["2","OpenGL","opengl"],["3","Filament","filament"],
  ["4","bgfx","bgfx"],["5","Three.js + WebGL","three-webgl"],["6","Three.js + WebGPU","three-webgpu"],
  ["7","Electron + Chromium","electron"]
];
function createWindow(index,title,mode) {
  const win = new BrowserWindow({width:520,height:760,minWidth:360,minHeight:480,
    title:"Saeed Render Lab — "+index+" — "+title,backgroundColor:"#101318",
    webPreferences:{contextIsolation:true,sandbox:true,webSecurity:true}});
  win.loadFile(path.join(__dirname,"index.html"),{query:{index,title,mode,glb:"saeed.ai.glb"}});
  return win;
}
app.whenReady().then(()=>modes.forEach(([i,t,m],n)=>{
  const win=createWindow(i,t,m);
  win.setPosition(40+(n%4)*520,40+Math.floor(n/4)*760);
}));
app.on("window-all-closed",()=>app.quit());
