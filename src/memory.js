const fs=require("fs"),path=require("path");
const SECRET_PATTERNS=[
 /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
 /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret)\s*[:=]\s*[^\s]+/i,
 /\b(?:sk|rk)-[A-Za-z0-9_-]{16,}\b/
];
const TYPES=new Set(["short_term","long_term","task","project","preference"]);
function normalizeType(v){const t=String(v||"long_term").toLowerCase();return TYPES.has(t)?t:"long_term"}
function containsSecret(text){return SECRET_PATTERNS.some(re=>re.test(String(text||"")))}
class Memory{
 constructor(){
  this.file=path.join(require("electron").app.getPath("userData"),"memory.json");
  try{this.data=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,"utf8")):[]}catch{this.data=[]}
  if(!Array.isArray(this.data))this.data=[];
  this.data=this.data.filter(x=>x&&typeof x==="object"&&!containsSecret(x.text));
 }
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(this.data.slice(-2000),null,2),"utf8")}
 add(text,tags=[],type="long_term",meta={}){
  const value=String(text||"").trim();
  if(!value)return{ok:false,error:"Memory text is empty."};
  if(containsSecret(value))return{ok:false,error:"Secret-like data is not stored in memory."};
  const item={id:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),text:value,tags:Array.isArray(tags)?tags.map(String).slice(0,20):[],type:normalizeType(type),project:meta?.project?String(meta.project):null,taskId:meta?.taskId?String(meta.taskId):null,created:new Date().toISOString(),updated:new Date().toISOString()};
  this.data.push(item);this.save();return{ok:true,memory:item};
 }
 search(q,{type,project,limit=20}={}){
  const words=String(q||"").toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length)return[];
  const wanted=type?normalizeType(type):null;
  const ranked=this.data.filter(x=>{
   if(wanted&&x.type!==wanted)return false;
   if(project&&String(x.project||"").toLowerCase()!==String(project).toLowerCase())return false;
   const hay=(String(x.text)+" "+(Array.isArray(x.tags)?x.tags.join(" "):"")+" "+String(x.project||"")).toLowerCase();
   return words.some(w=>hay.includes(w));
  }).map(x=>{
   const hay=(String(x.text)+" "+(Array.isArray(x.tags)?x.tags.join(" "):"")+" "+String(x.project||"")).toLowerCase();
   let score=0;for(const w of words){let p=hay.indexOf(w);while(p>=0){score++;p=hay.indexOf(w,p+w.length)}}
   if(wanted&&x.type===wanted)score+=3;
   if(project&&String(x.project||"").toLowerCase()===String(project).toLowerCase())score+=5;
   return{...x,_score:score};
  }).sort((a,b)=>b._score-a._score||String(b.updated||b.created).localeCompare(String(a.updated||a.created))).slice(0,Math.max(1,Number(limit)||20));
  return ranked.map(({_score,...item})=>item);
 }
 list({type,project,limit=100}={}){
  return this.data.filter(x=>(!type||x.type===normalizeType(type))&&(!project||String(x.project||"").toLowerCase()===String(project).toLowerCase())).slice(-Math.max(1,Number(limit)||100)).reverse();
 }
 clearType(type){const t=normalizeType(type);const before=this.data.length;this.data=this.data.filter(x=>x.type!==t);if(this.data.length!==before)this.save();return{ok:true,type:t,removed:before-this.data.length};}
 forget(id){
  const before=this.data.length;this.data=this.data.filter(x=>String(x.id)!==String(id));if(this.data.length!==before)this.save();
  return{ok:this.data.length!==before};
 }
}
module.exports={Memory,containsSecret};