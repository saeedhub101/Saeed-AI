const fs=require("fs"),path=require("path"),{builtinModules}=require("module");
const ROOT=path.resolve(__dirname,"..");
const SKIP=new Set(["electron"]);
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(["node_modules",".git","dist"].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.js$/.test(e.name))files.push(p);}}
walk(path.join(ROOT,"src"));
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,"package.json"),"utf8"));
const declared=new Set([...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})]);
const errors=[],checked=new Set();
function resolveLocal(from,spec){
 let p=path.resolve(path.dirname(from),spec);
 for(const candidate of [p,p+".js",path.join(p,"index.js")])if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return candidate;
 return null;
}
for(const file of files){
 const text=fs.readFileSync(file,"utf8");
 for(const m of text.matchAll(/require\s*\(\s*["']([^"']+)["']\s*\)/g)){
  const spec=m[1];
  if(spec.startsWith(".")){if(!resolveLocal(file,spec))errors.push(`${path.relative(ROOT,file)} -> missing local module "${spec}"`);continue;}
  if(builtinModules.includes(spec)||SKIP.has(spec))continue;
  const root=spec.startsWith("@")?spec.split("/").slice(0,2).join("/"):spec.split("/")[0];
  if(!declared.has(root))errors.push(`${path.relative(ROOT,file)} -> package "${root}" is not declared in package.json`);
  else {try{require.resolve(root,{paths:[ROOT]})}catch(e){errors.push(`${path.relative(ROOT,file)} -> package "${root}" cannot be resolved from node_modules`)}}
 }
}
const avatar=path.join(ROOT,"src","avatar.js");
if(fs.existsSync(avatar)){for(const m of fs.readFileSync(avatar,"utf8").matchAll(/from\s*["']([^"']+)["']/g)){if(m[1].startsWith(".")){if(!resolveLocal(avatar,m[1]))errors.push(`src/avatar.js -> missing imported module "${m[1]}"`);}}}
if(errors.length){console.error("MODULE RESOLUTION CHECK FAILED");errors.forEach(e=>console.error(" - "+e));process.exit(1);}
console.log(`MODULE RESOLUTION CHECK PASSED: ${files.length} JavaScript files scanned; local imports and declared package resolution verified.`);