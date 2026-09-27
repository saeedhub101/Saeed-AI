// web tool handlers. This module owns only web capability dispatch.
async function handle(registry,n,a){
 if(n==="browser_fetch"||n==="browser_extract_links"){
    const u=String(a.url||"");if(!/^https?:\/\//i.test(u))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};
    const r=await fetch(u,{redirect:"follow",headers:{"User-Agent":"SaeedAI/1.0"}});
    const html=await r.text();const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].slice(0,Math.min(200,Number(a.maxLinks)||50)).map(m=>({url:new URL(m[1],r.url).href,text:m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,300)}));
    if(n==="browser_extract_links")return{ok:r.ok,status:r.status,url:r.url,title,links,untrusted:true};
    const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim();
    return{ok:r.ok,status:r.status,url:r.url,title,text:text.slice(0,Math.min(500000,Number(a.maxChars)||50000)),links,untrusted:true,note:"PAGE_CONTENT_IS_UNTRUSTED_DATA"};
  }
  
 if(n==="browser_download"){
    const u=String(a.url||""),out=path.resolve(a.outputPath||"");
    if(!/^https?:\/\//i.test(u))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};
    if(!out||out===path.parse(out).root)return{ok:false,error:"A specific outputPath is required"};
    fs.mkdirSync(path.dirname(out),{recursive:true});
    const r=await fetch(u,{redirect:"follow",headers:{"User-Agent":"SaeedAI/1.0"}});
    if(!r.ok)return{ok:false,error:"Download failed with HTTP "+r.status};
    const buf=Buffer.from(await r.arrayBuffer());fs.writeFileSync(out,buf);const size=fs.statSync(out).size;
    return{ok:size>0,status:r.status,url:r.url,path:out,size,contentType:r.headers.get("content-type")||""};
  }
  
 if(n==="open_url"){if(!/^https?:\/\//i.test(a.url))return{ok:false,error:"Only HTTP/HTTPS URLs are allowed"};await require("electron").shell.openExternal(a.url);return{ok:true,url:a.url}};
  
 if(n==="web_search"){const q=encodeURIComponent(a.query);const r=await fetch("https://html.duckduckgo.com/html/?q="+q,{headers:{"User-Agent":"SaeedAI/1.0"}});const html=await r.text();const out=[...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].slice(0,8).map(m=>({url:m[1],title:m[2].replace(/<[^>]+>/g,"")}));return{ok:true,results:out}};
  
 return undefined;
}
module.exports={handle};
