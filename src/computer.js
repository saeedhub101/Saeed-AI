const {execFile}=require("child_process");
const {promisify}=require("util"); const run=promisify(execFile);
class Computer {
 async powershell(command){const r=await run("powershell.exe",["-NoProfile","-NonInteractive","-Command",command],{windowsHide:true,maxBuffer:4*1024*1024});return {ok:true,stdout:r.stdout,stderr:r.stderr}}
 async openApp(app,args=[]){const safe=String(app).replace(/[^\w .:\\/-]/g,"");return this.powershell('Start-Process -FilePath "'+safe+'"')}
 async type(text){return this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("'+String(text).replace(/["\\]/g,"")+'")')}
 async press(key){return this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("{'+key+'}")')}
 async mouse(x,y,button="left"){return this.powershell('Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Cursor]::Position=New-Object System.Drawing.Point('+Number(x)+','+Number(y)+');$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("{'+(button==="right"?"APPS":"ENTER")+'}")')}
}
module.exports={Computer};