const path=require("path");

const PROTECTED_ROOTS=[
  process.env.SystemRoot||"C:\\Windows",
  process.env.ProgramFiles||"C:\\Program Files",
  process.env["ProgramFiles(x86)"]||"C:\\Program Files (x86)"
].map(p=>path.resolve(p).toLowerCase());

function normalize(p){try{return path.resolve(String(p||"")).toLowerCase()}catch{return String(p||"").toLowerCase()}}
function isProtectedPath(p){
  const n=normalize(p);
  return PROTECTED_ROOTS.some(root=>n===root||n.startsWith(root+path.sep));
}

const SENSITIVE_PATHS=[/\\.ssh(\\|$)/i,/credentials/i,/tokens?/i,/secrets?/i,/password/i,/cookies?/i,/Login Data/i,/Web Data/i];\n\nconst HIGH_RISK_COMMANDS=[
  /\b(remove-item|del|erase|rd|rmdir)\b[\s\S]*(-recurse|\/s|\\s)/i,
  /\b(format-volume|format|diskpart|cipher\s+\/w)\b/i,
  /\b(shutdown|stop-computer|restart-computer|logoff)\b/i,
  /\b(reg\s+(delete|add|remove)|regedit)\b/i,
  /\b(sc\s+(delete|stop|config|create)|net\s+(user|localgroup|share))\b/i,
  /\b(set-executionpolicy|set-itemproperty|new-itemproperty|remove-itemproperty)\b/i,
  /\b(bcdedit|takeown|icacls|wevtutil|diskpart)\b/i,
  /\b(taskkill)\b[\s\S]*\/f/i
];

class PermissionEngine{
  constructor({confirm}={}){this.confirm=confirm|| (async()=>false)}
  inspect(name,args={}){
    const a=args||{};
    let dangerous=false,reason="",operation="";
    const file=a.filePath||a.destination||a.outputPath||a.source||"";
    if(name==="delete_file"){
      dangerous=true; operation="delete"; reason="Deleting a file or folder can permanently remove user data.";
    }else if(name==="read_file" && SENSITIVE_PATHS.some(re=>re.test(String(a.filePath||"")))){\n      dangerous=true; operation="read sensitive data"; reason="The target may contain credentials, authentication data, cookies, tokens, or other private secrets.";\n    }else if(name==="write_file" && isProtectedPath(a.filePath)){
      dangerous=true; operation="modify"; reason="The target is inside a protected Windows/program location.";
    }else if((name==="copy_file"||name==="move_file") && (isProtectedPath(a.destination)||isProtectedPath(a.source))){
      dangerous=true; operation=name==="copy_file"?"copy":"move"; reason="This operation affects a protected Windows/program location.";
    }else if(name==="run_command"){
      const cmd=String(a.command||"");
      if(HIGH_RISK_COMMANDS.some(re=>re.test(cmd))||isProtectedPath(a.workingDirectory)){
        dangerous=true; operation="system command"; reason="The command can change, delete, or control protected/system state.";
      }
    }else if((name==="open_application"||name==="run_command") && /(^|[\\/])(?:setup|installer|uninstall|uninstaller)(?:\.exe)?$/i.test(String(a.application||a.command||""))){\n      dangerous=true; operation="install or remove software"; reason="Installing or removing software changes the computer and may require elevated privileges.";\n    }else if(name==="open_application" && /(^|[\\/])(?:powershell|cmd|regedit|diskpart|services|msconfig|taskmgr)(?:\.exe)?$/i.test(String(a.application||""))){
      dangerous=true; operation="open system utility"; reason="This application can make privileged or system-level changes.";
    }
    if(!dangerous)return{required:false};
    const target=file||a.command||a.application||"the requested system resource";
    return{
      required:true,
      name,
      operation,
      target:String(target),
      reason,
      message:"Saeed needs your permission to perform the following operation: "+operation+" "+String(target)+". Reason: "+reason
    };
  }
  async authorize(name,args={}){
    const p=this.inspect(name,args);
    if(!p.required)return{allowed:true,required:false};
    const allowed=await this.confirm({name,args,permission:p});
    return{allowed:Boolean(allowed),required:true,permission:p};
  }
}
module.exports={PermissionEngine,isProtectedPath};
