// system tool handlers. This module owns only system capability dispatch.
async function handle(registry,n,a){
 if(n==="system_info")return{ok:true,platform:process.platform,release:os.release(),arch:process.arch,cpu:os.cpus().length,totalMemory:os.totalmem(),freeMemory:os.freemem(),uptime:os.uptime()};
  
 if(n==="diagnose_computer")return this.computer.diagnose();
  
 if(n==="active_window")return this.computer.activeWindow();
  
 if(n==="list_windows")return this.computer.listWindows();
  
 if(n==="process_list")return this.computer.processes();
  
 if(n==="disk_info"){const r=await this.computer.powershell("Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select DeviceID,Size,FreeSpace | ConvertTo-Json -Compress");try{return{ok:true,drives:JSON.parse(r.stdout)}}catch{return{ok:true,drives:[]}}}
  
 if(n==="network_info"){const r=await this.computer.powershell("Get-NetIPConfiguration | Select InterfaceAlias,IPv4Address,IPv6Address,DNSServer | ConvertTo-Json -Compress");try{return{ok:true,adapters:JSON.parse(r.stdout)}}catch{return{ok:true,adapters:[]}}}
  
 return undefined;
}
module.exports={handle};
