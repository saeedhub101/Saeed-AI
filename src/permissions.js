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

const SENSITIVE_PATHS=[/\\.ssh(\\|$)/i,/credentials/i,/tokens?/i,/secrets?/i,/password/i,/cookies?/i,/Login Data/i,/Web Data/i];\n\nconst SENSITIVE_PATHS=[/\.ssh(\\|$)/i,/credentials/i,/tokens?/i,/secrets?/i,/password/i,/cookies?/i];

const DEFAULT_POLICY={mode:"full_access",askAlways:[],denied:[],criticalAlwaysAsk:true};

const CRITICAL_OPERATION_NAMES=new Set(["delete_file","send_money","make_payment","purchase","place_order","financial_transaction","install_software","uninstall_software"]);
function isCritical(name,args={}){
 const c=String(args.command||"");
 return CRITICAL_OPERATION_NAMES.has(name) ||
   /\b(shutdown|stop-computer|restart-computer|logoff|diskpart|bcdedit|reg\s+(delete|add|remove)|regedit|sc\s+(delete|stop|config|create))\b/i.test(c) ||
   (["write_file","copy_file","move_file"].includes(name) && (isProtectedPath(args.filePath)||isProtectedPath(args.source)||isProtectedPath(args.destination)));
}
const HIGH_RISK_COMMANDS=[
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

  constructor({confirm,policy}={}){this.confirm=confirm|| (async()=>false);this.policy={...DEFAULT_POLICY,...(policy||{})}}
  setPolicy(policy={}){this.policy={...DEFAULT_POLICY,...(this.policy||{}),...policy};return this.getPolicy()}
  getPolicy(){return {...DEFAULT_POLICY,...(this.policy||{}),askAlways:[...(this.policy?.askAlways||[])],denied:[...(this.policy?.denied||[])]}}
  inspect(name,args={}){
    const policy=this.policy||DEFAULT_POLICY;
    const denied=policy.denied.includes(name);
    if(denied)return{required:true,denied:true,name,operation:name,target:String(args.filePath||args.destination||args.command||args.application||"requested resource"),reason:"Disabled in Permissions settings."};
    const critical=isCritical(name,args);
    const ask=policy.askAlways.includes(name)||(critical&&policy.criticalAlwaysAsk);
    if(!ask)return{required:false,allowed:true,mode:policy.mode};
    const a=args||{};
    let dangerous=false,reason="",operation="";
    const file=a.filePath||a.destination||a.outputPath||a.source||"";
    if(name==="delete_file"){
      dangerous=true; operation="delete"; reason="Deleting a file or folder can permanently remove user data.";
    }else if(name==="read_file" && SENSITIVE_PATHS.some(re=>re.test(String(a.filePath||"")))){\n      dangerous=true; operation="read sensitive data"; reason="The target may contain credentials, authentication data, cookies, tokens, or other private secrets.";\n    }else if(name==="read_file" && SENSITIVE_PATHS.some(re=>re.test(String(a.filePath||"")))){
      dangerous=true; operation="read sensitive data"; reason="The target may contain credentials, tokens, cookies, passwords, or other private secrets.";
    }else if(name==="write_file" && isProtectedPath(a.filePath)){
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
