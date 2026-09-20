const os=require("os"),fs=require("fs"),path=require("path");
class ToolRegistry{
 schemas(){return[
 {type:"function",function:{name:"system_info",description:"Inspect this Windows computer's basic CPU and memory information.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"list_directory",description:"List a directory.",parameters:{type:"object",properties:{directory:{type:"string"}},required:["directory"]}}},
 {type:"function",function:{name:"read_file",description:"Read a UTF-8 text file.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
 {type:"function",function:{name:"add_task",description:"Remember a task.",parameters:{type:"object",properties:{title:{type:"string"}},required:["title"]}}}
 ]}
 async call(n,a){
  if(n==="system_info")return{ok:true,platform:process.platform,release:os.release(),cpu:os.cpus().length,totalMemory:os.totalmem(),freeMemory:os.freemem()};
  if(n==="list_directory")return{ok:true,files:fs.readdirSync(path.resolve(a.directory||"."),{withFileTypes:true}).map(x=>({name:x.name,directory:x.isDirectory()}))};
  if(n==="read_file")return{ok:true,content:fs.readFileSync(path.resolve(a.filePath),"utf8").slice(0,200000)};
  if(n==="add_task")return{ok:true,message:"Task remembered for this session",title:a.title};
  return{ok:false,error:"Unknown tool"};
 }
}
module.exports={ToolRegistry};