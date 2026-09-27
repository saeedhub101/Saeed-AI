// office tool handlers. This module owns only office capability dispatch.
async function handle(registry,n,a){
 if(n==="excel_inspect")return this.office.excel("inspect",a);
  
 if(n==="excel_read_cell")return this.office.excel("read_cell",a);
  
 if(n==="excel_write_cell")return this.office.excel("write_cell",a);
  
 if(n==="excel_append_rows")return this.office.excel("append_rows",a);
  
 if(n==="excel_create")return this.office.excel("create",a);
  
 if(n==="word_read_text")return this.office.word("read_text",a);
  
 if(n==="word_replace_text")return this.office.word("replace_text",a);
  
 if(n==="pdf_extract_text"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};const r=await this.computer.runCommand("pdftotext -layout \""+p.replace(/"/g,'""')+"\" -",process.cwd());return {...r,text:String(r.stdout||"")};}
  
 if(n==="pdf_search"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};const r=await this.computer.runCommand("pdftotext -layout \""+p.replace(/"/g,'""')+"\" -",process.cwd());if(r.ok===false)return r;const pages=String(r.stdout||"").split("\f");const q=String(a.query||"").toLowerCase();const matches=[];pages.forEach((txt,i)=>{if(q&&txt.toLowerCase().includes(q))matches.push({page:i+1,snippet:txt.slice(Math.max(0,txt.toLowerCase().indexOf(q)-350),Math.min(txt.length,txt.toLowerCase().indexOf(q)+q.length+700))})});return{ok:true,query:a.query,pages:matches};}
  
 if(n==="pdf_render_pages"){const p=path.resolve(a.filePath);if(!fs.existsSync(p))return{ok:false,error:"PDF not found"};const pages=[...(a.pages||[])].filter(n=>Number.isInteger(n)&&n>0).slice(0,8);if(!pages.length)return{ok:false,error:"At least one page number is required"};const dpi=Math.min(180,Math.max(72,Number(a.dpi)||120));const tmp=path.join(this.userDataPath,"pdf-render");fs.mkdirSync(tmp,{recursive:true});const images=[];for(const page of pages){const prefix=path.join(tmp,"page-"+page+"-"+Date.now());const r=await this.computer.runCommand("pdftoppm -f "+page+" -singlefile -r "+dpi+" -jpeg \""+p.replace(/"/g,'""')+"\" \""+prefix.replace(/"/g,'""')+"\"",process.cwd());if(r.ok===false)continue;const jpg=prefix+".jpg";if(fs.existsSync(jpg)){images.push({page,path:jpg,dataUrl:"data:image/jpeg;base64,"+fs.readFileSync(jpg).toString("base64")})}}return{ok:images.length>0,pages:images};}
  return{ok:false,error:"Unknown tool"};
 }catch(e){return{ok:false,error:e.message}}}

 return undefined;
}
module.exports={handle};
