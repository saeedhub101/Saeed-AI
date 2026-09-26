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
