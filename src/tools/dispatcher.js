const {getToolSchemas}=require("./schemas");
const handlers=[
 require("./project_tools"),require("./system_tools"),require("./web_tools"),
 require("./vision_tools"),require("./filesystem_tools"),require("./computer_tools"),
 require("./memory_tools"),require("./office_tools"),require("./data_tools"),
 require("./email_tools"),require("./scheduling_tools")
];
async function dispatchToolCall(registry,n,a={}){
 try{
  const auth=await registry.permissions.authorize(n,a||{});
  if(!auth.allowed)return{ok:false,error:"User denied permission.",permission:auth.permission||null,denied:true};
  for(const mod of handlers){const result=await mod.handle(registry,n,a||{});if(result!==undefined)return result;}
  return{ok:false,error:"Unknown tool"};
 }catch(e){return{ok:false,error:e.message};}
}
module.exports={dispatchToolCall,getToolSchemas};
