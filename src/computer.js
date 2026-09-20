const {execFile}=require("child_process"),{promisify}=require("util"),run=promisify(execFile);
class Computer{
 async powershell(command){const r=await run("powershell.exe",["-NoProfile","-NonInteractive","-Command",command],{windowsHide:true,maxBuffer:4194304});return{ok:true,stdout:r.stdout,stderr:r.stderr}}
 async openApp(app){const safe=String(app).replace(/["']/g,"");return this.powershell('Start-Process -FilePath "'+safe+'"')}
 async mouseMove(x,y){return this.powershell('$sig=@\'using System;using System.Runtime.InteropServices;public class M{[DllImport("user32.dll")]public static extern bool SetCursorPos(int X,int Y);}\'@;Add-Type $sig;[M]::SetCursorPos('+Number(x)+','+Number(y))')}
 async mouseClick(x,y,button="left"){const b=button==="right"?2:1;return this.powershell('$sig=@\'using System;using System.Runtime.InteropServices;public class M{[DllImport("user32.dll")]public static extern bool SetCursorPos(int X,int Y);[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint data,UIntPtr e);}\'@;Add-Type $sig;[M]::SetCursorPos('+Number(x)+','+Number(y)+');[M]::mouse_event('+(b===2?"8,0,0,0,[UIntPtr]::Zero;[M]::mouse_event(16,0,0,0,[UIntPtr]::Zero)":"2,0,0,0,[UIntPtr]::Zero;[M]::mouse_event(4,0,0,0,[UIntPtr]::Zero)")+')')}
 async typeText(text){const t=String(text).replace(/[+^%~(){}]/g,c=>'{'+c+'}').replace(/"/g,'');return this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("'+t+'")')}
 async keyPress(key){return this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("{'+String(key).replace(/"/g,"")+'}")')}
}
module.exports={Computer};