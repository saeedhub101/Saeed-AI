const crypto=require("crypto");

class VerificationEngine{
  constructor({computer}={}){this.computer=computer||null}
  async verify(kind,expected={},before=null,after=null){
    const k=String(kind||"").toLowerCase();
    try{
      if(k==="file_exists"){
        const fs=require("fs"); const p=String(expected.path||"");
        const exists=fs.existsSync(p);
        return {ok:exists,verified:exists,kind:k,evidence:{path:p,exists}};
      }
      if(k==="file_absent"){
        const fs=require("fs"); const p=String(expected.path||"");
        const exists=fs.existsSync(p);
        return {ok:!exists,verified:!exists,kind:k,evidence:{path:p,exists}};
      }
      if(k==="window_title"){
        const title=String(after?.window?.title||after?.title||"");
        const wanted=String(expected.contains||expected.title||"");
        const ok=wanted?title.toLowerCase().includes(wanted.toLowerCase()):Boolean(title);
        return {ok,verified:ok,kind:k,evidence:{title,wanted}};
      }
      if(k==="active_window_changed"){
        const a=before?.window?.title||before?.title||"", b=after?.window?.title||after?.title||"";
        const ok=String(a)!==String(b);
        return {ok,verified:ok,kind:k,evidence:{before:a,after:b}};
      }
      if(k==="command"){
        const result=after||{};
        const exitOk=result.exitCode===undefined||result.exitCode===0;
        const stderr=String(result.stderr||"").trim();
        const expect=expected.stdoutContains;
        const contains=expect?String(result.stdout||"").toLowerCase().includes(String(expect).toLowerCase()):true;
        const ok=Boolean(result.ok)&&exitOk&&contains;
        return {ok,verified:ok,kind:k,evidence:{exitCode:result.exitCode??0,stderr:stderr.slice(0,2000),stdout:String(result.stdout||"").slice(0,4000),stdoutContains:expect||null}};
      }
      if(k==="gui_state"){
        const beforeTitle=String(before?.window?.title||"");
        const afterTitle=String(after?.window?.title||"");
        const changed=beforeTitle!==afterTitle;
        const wanted=expected.windowTitleContains?afterTitle.toLowerCase().includes(String(expected.windowTitleContains).toLowerCase()):true;
        const ok=wanted&&(expected.requireChange?changed:true);
        return {ok,verified:ok,kind:k,evidence:{beforeTitle,afterTitle,changed}};
      }
      if(k==="text_contains"){
        const fs=require("fs"),p=String(expected.path||""),wanted=String(expected.text||"");
        const text=fs.readFileSync(p,"utf8");
        const ok=text.toLowerCase().includes(wanted.toLowerCase());
        return {ok,verified:ok,kind:k,evidence:{path:p,contains:ok,wanted:wanted.slice(0,500)}};
      }
      if(k==="file_nonempty"){const fs=require("fs"),p=String(expected.path||"");const exists=fs.existsSync(p),size=exists?fs.statSync(p).size:0,ok=exists&&size>0;return{ok,verified:ok,kind:k,evidence:{path:p,exists,size}};}
      if(k==="file_size"){
        const fs=require("fs"),p=String(expected.path||""),size=fs.statSync(p).size;
        const min=expected.minBytes==null?0:Number(expected.minBytes),max=expected.maxBytes==null?Infinity:Number(expected.maxBytes);
        const ok=size>=min&&size<=max;
        return {ok,verified:ok,kind:k,evidence:{path:p,size,minBytes:min,maxBytes:max}};
      }
      if(k==="process_exists"){
        const pid=Number(expected.pid);
        if(!this.computer)return {ok:false,verified:false,kind:k,error:"Computer verifier unavailable"};
        const r=await this.computer.powershell("Get-Process -Id "+Math.round(pid)+" -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | ConvertTo-Json -Compress");
        const ok=Boolean(String(r.stdout||"").trim());
        return {ok,verified:ok,kind:k,evidence:{pid,raw:String(r.stdout||"")}};
      }
      if(k==="window_exists"){const wanted=String(expected.titleContains||"").toLowerCase();if(!this.computer)return{ok:false,verified:false,kind:k,error:"Computer verifier unavailable"};const r=await this.computer.listWindows();const ws=Array.isArray(r.windows)?r.windows:[r.windows].filter(Boolean);const match=ws.find(w=>String(w.MainWindowTitle||"").toLowerCase().includes(wanted));const ok=Boolean(match);return{ok,verified:ok,kind:k,evidence:{titleContains:wanted,window:match||null}};}
      if(k==="directory_exists"){const fs=require("fs"),p=String(expected.path||"");const ok=fs.existsSync(p)&&fs.statSync(p).isDirectory();return{ok,verified:ok,kind:k,evidence:{path:p,isDirectory:ok}};}
      if(k==="exists_in_directory"){
        const fs=require("fs"),path=require("path");
        const dir=String(expected.directory||""), name=String(expected.name||"");
        const target=path.join(dir,name), exists=fs.existsSync(target);
        return {ok:exists,verified:exists,kind:k,evidence:{target,exists}};
      }
      return {ok:false,verified:false,kind:k,error:"Unknown verification type"};
    }catch(e){return {ok:false,verified:false,kind:k,error:e.message}}
  }
}
module.exports={VerificationEngine};
