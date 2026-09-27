const {getToolSchemas}=require("./tools/schemas");
const handlers=[
 require("./tools/project_tools"),require("./tools/system_tools"),require("./tools/web_tools"),
 require("./tools/vision_tools"),require("./tools/filesystem_tools"),require("./tools/computer_tools"),
 require("./tools/memory_tools"),require("./tools/office_tools"),require("./tools/data_tools"),
 require("./tools/email_tools"),require("./tools/scheduling_tools")
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
