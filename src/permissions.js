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

const SENSITIVE_PATHS=[/\\.ssh(\\|$)/i,/credentials/i,/tokens?/i,/secrets?/i,/password/i,/cookies?/i,/login data/i,/web data/i,/local state/i];

const DEFAULT_POLICY={mode:"full_access",askAlways:[],denied:[],criticalAlwaysAsk:true};

const CATEGORY_TOOLS={
 files:["list_directory","read_file","write_file","copy_file","move_file","delete_file","create_directory","reveal_file"],
 system_commands:["run_command","system_info","diagnose_computer","process_list","disk_info","network_info"],
 applications:["open_application","focus_window","mouse_move","mouse_click","type_text","key_press"],
 software:["install_software","uninstall_software"],registry_services:["run_command"],shutdown:["run_command"],
 private_data:["read_file","list_directory","copy_file","move_file"],
 browser:["open_url","web_search","mouse_move","mouse_click","type_text","key_press"],
 financial:["send_money","make_payment","purchase","place_order","financial_transaction"],
 office:["excel_inspect","excel_read_cell","excel_write_cell","excel_append_rows","excel_create","word_read_text","word_replace_text","pdf_extract_text"]
};
const CRITICAL_OPERATION_NAMES=new Set(["delete_file","send_money","make_payment","purchase","place_order","financial_transaction","install_software","uninstall_software"]);
const CRITICAL_CATEGORIES=new Set(["software","registry_services","shutdown","financial"]);
function categoryFor(name){return Object.keys(CATEGORY_TOOLS).filter(c=>CATEGORY_TOOLS[c].includes(name))}
function policyMatches(list,name){const set=new Set(Array.isArray(list)?list:[]);return set.has(name)||categoryFor(name).some(c=>set.has(c))}
function isCritical(name,args={}){
 const c=String(args.command||"");
 return CRITICAL_OPERATION_NAMES.has(name)||categoryFor(name).some(c=>CRITICAL_CATEGORIES.has(c))||
 /\b(shutdown|stop-computer|restart-computer|logoff|diskpart|bcdedit|reg\s+(delete|add|remove)|regedit|sc\s+(delete|stop|config|create))\b/i.test(c)||
 (["write_file","copy_file","move_file"].includes(name)&&(isProtectedPath(args.filePath)||isProtectedPath(args.source)||isProtectedPath(args.destination)));
}
class PermissionEngine{

  constructor({confirm,policy}={}){this.confirm=confirm|| (async()=>false);this.policy={...DEFAULT_POLICY,...(policy||{})}}
  setPolicy(policy={}){
    this.policy={...DEFAULT_POLICY,...this.policy,...policy,
      askAlways:Array.isArray(policy.askAlways)?policy.askAlways:[...(this.policy.askAlways||[])],
      denied:Array.isArray(policy.denied)?policy.denied:[...(this.policy.denied||[])]
    };
    return this.getPolicy();
  }
  getPolicy(){return {...DEFAULT_POLICY,...(this.policy||{}),askAlways:[...(this.policy?.askAlways||[])],denied:[...(this.policy?.denied||[])]}}
  getCategories(){return Object.entries(CATEGORY_TOOLS).map(([id,tools])=>({id,tools:[...tools]}))}
  inspect(name,args={}){
    const policy=this.policy||DEFAULT_POLICY;
    if(policyMatches(policy.denied,name))return{required:true,denied:true,name,operation:name,target:String(args.filePath||args.destination||args.command||args.application||"requested resource"),reason:"This operation is disabled in Permissions settings."};
    const critical=isCritical(name,args);
    const sensitiveRead=name==="read_file"&&SENSITIVE_PATHS.some(re=>re.test(String(args.filePath||"")));
    const ask=policyMatches(policy.askAlways,name)||(critical&&policy.criticalAlwaysAsk)||sensitiveRead;
    if(!ask)return{required:false,allowed:true,mode:policy.mode};
    let operation=name,reason="This operation is configured to require your approval.";
    const file=args.filePath||args.destination||args.outputPath||args.source||"";
    let dangerous=true;
    if(name==="delete_file"){operation="delete";reason="Deleting a file or folder can permanently remove user data."}
    else if(sensitiveRead){operation="read sensitive data";reason="The target may contain credentials, authentication data, cookies, tokens, passwords, or other private information."}
    else if(name==="write_file"&&isProtectedPath(args.filePath)){operation="modify protected system file";reason="The target is inside a protected Windows or program location."}
    else if((name==="copy_file"||name==="move_file")&&(isProtectedPath(args.destination)||isProtectedPath(args.source))){operation=name==="copy_file"?"copy to protected location":"move from/to protected location";reason="This operation affects a protected Windows or program location."}
    else if(name==="run_command"){
      const cmd=String(args.command||"");
      if(!HIGH_RISK_COMMANDS.some(re=>re.test(cmd))&&!isProtectedPath(args.workingDirectory)&&!critical)return{required:false,allowed:true};
      operation="system command";reason="The command can change, delete, or control protected/system state.";
    }else if(name==="open_application"&&/(^|[\\\\/])(?:setup|installer|uninstall|uninstaller)(?:\.exe)?$/i.test(String(args.application||""))){
      operation="install or remove software";reason="Installing or removing software changes the computer and may require elevated privileges.";
    }else if(name==="open_application"&&/(^|[\\\\/])(?:powershell|cmd|regedit|diskpart|services|msconfig|taskmgr)(?:\.exe)?$/i.test(String(args.application||""))){
      operation="open system utility";reason="This application can make privileged or system-level changes.";
    }else if(critical){operation=name.replace(/_/g," ");reason="This is a critical operation with potentially irreversible consequences."}
    const target=file||args.command||args.application||"the requested system resource";
    return{required:true,name,operation,target:String(target),reason,message:"Saeed needs your permission to perform the following operation: "+operation+" "+String(target)+". Reason: "+reason};
  }
  async authorize(name,args={}){
    const p=this.inspect(name,args);
    if(!p.required)return{allowed:true,required:false};
    const allowed=await this.confirm({name,args,permission:p});
    return{allowed:Boolean(allowed),required:true,permission:p};
  }
}
module.exports={PermissionEngine,isProtectedPath};
