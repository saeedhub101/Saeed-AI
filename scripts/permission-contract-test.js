const assert=require("assert");
const {PermissionEngine}=require("../src/permissions");
(async()=>{
 let asked=null;
 const p=new PermissionEngine({confirm:async x=>{asked=x;return true},policy:{mode:"full_access",criticalAlwaysAsk:true}});
 const d=p.inspect("delete_file",{filePath:"C:\\Users\\Test\\file.txt"});
 assert.equal(d.required,true);
 assert.match(d.message,/permission/i);
 const a=await p.authorize("delete_file",{filePath:"C:\\Users\\Test\\file.txt"});
 assert.equal(a.allowed,true);
 assert.equal(asked.permission.operation,"delete");
 const denied=new PermissionEngine({confirm:async()=>{throw new Error("confirm must not run")},policy:{mode:"full_access",denied:["delete_file"]}});
 const x=denied.inspect("delete_file",{filePath:"C:\\Users\\Test\\file.txt"});
 assert.equal(x.required,true); assert.equal(x.denied,true);
 const r=await denied.authorize("delete_file",{filePath:"C:\\Users\\Test\\file.txt"});
 assert.equal(r.allowed,false);
 console.log("Permission Allow/Deny contract passed.");
})().catch(e=>{console.error("Permission contract failed:",e);process.exit(1)});
