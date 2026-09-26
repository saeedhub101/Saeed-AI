const fs=require("fs"),path=require("path"),crypto=require("crypto");

const ALLOWED_EXT=new Set([".txt",".md",".json",".csv",".log",".xml",".js",".ts",".cpp",".hpp",".h",".py",".rs",".html",".css",".yml",".yaml",".toml"]);
const SECRET_NAMES=new Set([".env",".env.local",".env.production",".env.development","credentials.json","secrets.json","token.json"]);
const SECRET_RE=/(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|private[_-]?key|authorization)\s*[:=]/i;

class KnowledgeStore{
 constructor({file}={}){this.file=file||path.join(process.cwd(),"knowledge.json");this.items=this.load()}
 load(){try{const x=JSON.parse(fs.readFileSync(this.file,"utf8"));return Array.isArray(x)?x:[]}catch{return[]}}
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+".tmp";fs.writeFileSync(tmp,JSON.stringify(this.items,null,2),"utf8");fs.renameSync(tmp,this.file)}
 isSecretPath(p){const n=path.basename(p).toLowerCase();if(SECRET_NAMES.has(n)||n.startsWith(".env."))return true;return p.split(path.sep).some(part=>[".ssh",".aws",".azure","credentials","secrets"].includes(part.toLowerCase()))}
 sanitize(text){return String(text||"").split(/\r?\n/).filter(line=>!SECRET_RE.test(line)).join("\n")}
 indexFile(filePath,{project=""}={}){
  const p=path.resolve(String(filePath||""));if(!p)return{ok:false,error:"filePath is required"};
  if(this.isSecretPath(p))return{ok:false,error:"Knowledge indexing refuses credential/secret paths."};
  if(!fs.existsSync(p)||!fs.statSync(p).isFile())return{ok:false,error:"File not found."};
  const ext=path.extname(p).toLowerCase();if(!ALLOWED_EXT.has(ext))return{ok:false,error:"Unsupported text source."};
  const st=fs.statSync(p);if(st.size>5*1024*1024)return{ok:false,error:"Source file is too large for knowledge indexing."};
  const raw=fs.readFileSync(p,"utf8").slice(0,1000000),text=this.sanitize(raw);
  if(!text.trim())return{ok:false,error:"No non-secret text available to index."};
  const id=crypto.createHash("sha256").update(p).digest("hex"),indexedAt=new Date().toISOString();
  this.items=this.items.filter(x=>x.id!==id);this.items.push({id,path:p,project:String(project||""),extension:ext,text,indexedAt});this.save();
  return{ok:true,id,path:p,project:String(project||""),chars:text.length,indexedAt};
 }
 search(query,{project="",limit=10}={}){
  const q=String(query||"").toLowerCase().trim();if(!q)return{ok:false,error:"query is required"};
  const terms=q.split(/\s+/).filter(Boolean);
  const ranked=this.items.filter(x=>!project||x.project===project).map(x=>{const t=String(x.text||"").toLowerCase();let score=0;for(const term of terms){let pos=t.indexOf(term);while(pos>=0){score++;pos=t.indexOf(term,pos+term.length)}}return{...x,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.min(50,Math.max(1,Number(limit)||10)));
  return{ok:true,query:q,count:ranked.length,results:ranked.map(x=>({path:x.path,project:x.project,score:x.score,snippet:String(x.text).slice(0,1200),indexedAt:x.indexedAt}))};
 }
}
module.exports={KnowledgeStore};
