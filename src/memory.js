const fs=require("fs"),path=require("path");
class Memory{
 constructor(){this.file=path.join(require("electron").app.getPath("userData"),"memory.json");this.data=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file)):[]}
 save(){fs.writeFileSync(this.file,JSON.stringify(this.data,null,2))}
 add(text,tags=[]){this.data.push({id:Date.now().toString(),text,tags,created:new Date().toISOString()});this.save();return this.data.at(-1)}
 search(q){const words=q.toLowerCase().split(/\s+/);return this.data.filter(x=>words.some(w=>(x.text+" "+x.tags.join(" ")).toLowerCase().includes(w))).slice(-20)}
}
module.exports={Memory};