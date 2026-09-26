const tls=require("tls");
const net=require("net");
const {ImapFlow}=require("imapflow");
const nodemailer=require("nodemailer");
const {simpleParser}=require("mailparser");

function timeout(promise,ms=20000){
 return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("Email operation timed out.")),ms))]);
}
function normalizeConfig(c={}){
 const incoming=String(c.incomingProtocol||"imap").toLowerCase()==="pop3"?"pop3":"imap";
 return {
  email:String(c.email||""),
  incomingProtocol:incoming,
  incomingHost:String(c.incomingHost||""),
  incomingPort:Number(c.incomingPort|| (incoming==="imap"?993:995)),
  incomingSecurity:String(c.incomingSecurity||"ssl"),
  outgoingHost:String(c.outgoingHost||""),
  outgoingPort:Number(c.outgoingPort||465),
  outgoingSecurity:String(c.outgoingSecurity||"ssl"),
  username:String(c.username||c.email||""),
  password:String(c.password||""),
  rejectUnauthorized:c.rejectUnauthorized!==false
 };
}
function parseSecurity(value,port){
 const s=String(value||"ssl").toLowerCase();
 return s==="none"?"none":s==="starttls"?"starttls":(s==="tls"?"ssl":"ssl");
}
async function testImap(c){
 const secure=parseSecurity(c.incomingSecurity,c.incomingPort)==="ssl";
 const client=new ImapFlow({host:c.incomingHost,port:c.incomingPort,secure,auth:{user:c.username,pass:c.password},tls:{rejectUnauthorized:c.rejectUnauthorized!==false},logger:false});
 await timeout(client.connect());
 let mailbox=null;
 try{mailbox=await timeout(client.mailboxOpen("INBOX",{readOnly:true}));}
 finally{try{await client.logout()}catch{}}
 return {ok:true,protocol:"imap",mailbox:{path:"INBOX",exists:mailbox.exists,uidNext:mailbox.uidNext}};
}
function pop3Command(socket,command){
 return new Promise((resolve,reject)=>{
  let data="",done=false;
  const finish=(err,value)=>{if(done)return;done=true;socket.removeListener("data",onData);socket.removeListener("error",onError);socket.removeListener("close",onClose);err?reject(err):resolve(value)};
  const onData=chunk=>{data+=chunk.toString("utf8");if(command.startsWith("RETR")||command==="UIDL"||command==="LIST"){if(/\r?\n\.\r?\n$/.test(data)||/\r?\n\.\r?\n/.test(data.slice(-8)))finish(null,data)}else if(/\r?\n/.test(data)){finish(null,data)}};
  const onError=e=>finish(e);const onClose=()=>finish(new Error("POP3 connection closed."));
  socket.on("data",onData);socket.once("error",onError);socket.once("close",onClose);socket.write(command+"\r\n");
 });
}
async function pop3Request(c,commands){
 const secure=parseSecurity(c.incomingSecurity,c.incomingPort)==="ssl";
 const socket=secure?tls.connect({host:c.incomingHost,port:c.incomingPort,rejectUnauthorized:c.rejectUnauthorized!==false}):net.connect({host:c.incomingHost,port:c.incomingPort});
 await new Promise((resolve,reject)=>{socket.once("connect",resolve);socket.once("error",reject)});
 let greeting=await new Promise((resolve,reject)=>{let d="";const f=x=>{d+=x.toString();if(/\r?\n/.test(d)){socket.removeListener("data",f);resolve(d)}};socket.on("data",f);socket.once("error",reject)});
 if(!/^\+OK/i.test(greeting))throw new Error(greeting.trim());
 const out=[];
 for(const cmd of commands){const r=await timeout(pop3Command(socket,cmd));if(!/^\+OK/i.test(r))throw new Error(r.trim());out.push(r)}
 socket.write("QUIT\r\n");socket.end();
 return out;
}
function cleanPopLines(text){return String(text).replace(/^\+OK[^\r\n]*\r?\n/i,"").replace(/\r?\n\.\r?\n$/,"\n");}
async function testPop3(c){
 const r=await pop3Request(c,["USER "+c.username,"PASS "+c.password,"STAT"]);
 return {ok:true,protocol:"pop3",stat:cleanPopLines(r[2]).trim()};
}
async function connectImap(c){
 const secure=parseSecurity(c.incomingSecurity,c.incomingPort)==="ssl";
 const client=new ImapFlow({host:c.incomingHost,port:c.incomingPort,secure,auth:{user:c.username,pass:c.password},tls:{rejectUnauthorized:c.rejectUnauthorized!==false},logger:false});
 await timeout(client.connect());return client;
}
async function listImap(c,limit=20){
 const client=await connectImap(c);try{
  const lock=await client.getMailboxLock("INBOX");
  try{
   const status=await client.status("INBOX",{messages:true});
   const total=Number(status.messages||0),start=Math.max(1,total-Number(limit)+1),out=[];
   for await(const m of client.fetch(start+":*",{uid:true,envelope:true,flags:true,internalDate:true,size:true})){
    out.push({uid:m.uid,subject:m.envelope?.subject||"",from:(m.envelope?.from||[]).map(x=>x.address||x.name).filter(Boolean),to:(m.envelope?.to||[]).map(x=>x.address||x.name).filter(Boolean),date:m.internalDate||m.envelope?.date||null,flags:[...(m.flags||[])],size:m.size||0});
   }
   return {ok:true,protocol:"imap",folder:"INBOX",total,messages:out.slice(-Number(limit))};
  }finally{lock.release()}
 }finally{try{await client.logout()}catch{}}
}
async function readImap(c,uid){
 const client=await connectImap(c);try{
  const lock=await client.getMailboxLock("INBOX");
  try{
   const m=await client.fetchOne(Number(uid),{uid:true,source:true,envelope:true});
   if(!m)return{ok:false,error:"Email not found."};
   const parsed=await simpleParser(m.source);
   return {ok:true,protocol:"imap",uid:Number(uid),email:serializeParsed(parsed)};
  }finally{lock.release()}
 }finally{try{await client.logout()}catch{}}
}
async function searchImap(c,query,limit=20){
 const client=await connectImap(c);try{
  const lock=await client.getMailboxLock("INBOX");
  try{
   const q=String(query||"").trim();let uids=[];
   if(q)uids=await client.search({or:[{subject:q},{from:q},{to:q},{body:q}]},{uid:true});
   else uids=await client.search({all:true},{uid:true});
   const selected=uids.slice(-Number(limit)),out=[];
   if(selected.length)for await(const m of client.fetch(selected,{uid:true,envelope:true,flags:true,internalDate:true})){
    out.push({uid:m.uid,subject:m.envelope?.subject||"",from:(m.envelope?.from||[]).map(x=>x.address||x.name).filter(Boolean),date:m.internalDate||m.envelope?.date||null,flags:[...(m.flags||[])]});
   }
   return {ok:true,protocol:"imap",query:q,messages:out};
  }finally{lock.release()}
 }finally{try{await client.logout()}catch{}}
}
async function listPop3(c,limit=20){
 const r=await pop3Request(c,["USER "+c.username,"PASS "+c.password,"UIDL","LIST"]);
 const uidLines=cleanPopLines(r[2]).split(/\r?\n/).filter(Boolean),listLines=cleanPopLines(r[3]).split(/\r?\n/).filter(Boolean);
 const rows=uidLines.filter(x=>/^\d+\s+\S+/.test(x)).map(x=>{const [n,uid]=x.trim().split(/\s+/);const sizeLine=listLines.find(y=>y.startsWith(n+" "));return{number:Number(n),uid,size:sizeLine?Number(sizeLine.split(/\s+/)[1]):0}}).slice(-Number(limit));
 return {ok:true,protocol:"pop3",messages:rows};
}
async function readPop3(c,number){
 const r=await pop3Request(c,["USER "+c.username,"PASS "+c.password,"RETR "+Number(number)]);
 const parsed=await simpleParser(cleanPopLines(r[2]));
 return {ok:true,protocol:"pop3",number:Number(number),email:serializeParsed(parsed)};
}
function serializeParsed(p){
 return {messageId:p.messageId||null,date:p.date||null,subject:p.subject||"",from:p.from?.value||[],to:p.to?.value||[],cc:p.cc?.value||[],text:String(p.text||"").slice(0,200000),html:p.html?String(p.html).slice(0,200000):null,attachments:(p.attachments||[]).map(a=>({filename:a.filename||"attachment",contentType:a.contentType,size:a.size||a.content?.length||0}))};
}
class EmailService{
 constructor({getConfig}={}){this.getConfig=getConfig||(()=>({}))}
 config(extra={}){return normalizeConfig({...this.getConfig(),...extra})}
 async test(extra={}){const c=this.config(extra);if(!c.incomingHost||!c.username||!c.password)return{ok:false,error:"Email incoming server, username and password are required."};const incoming=c.incomingProtocol==="pop3"?await testPop3(c):await testImap(c);if(!c.outgoingHost)return{ok:true,incoming, smtp:{ok:false,error:"SMTP server is not configured."}};const security=parseSecurity(c.outgoingSecurity,c.outgoingPort),transporter=nodemailer.createTransport({host:c.outgoingHost,port:c.outgoingPort,secure:security==="ssl",auth:{user:c.username,pass:c.password},tls:{rejectUnauthorized:c.rejectUnauthorized!==false}});await timeout(transporter.verify());return{ok:true,incoming,smtp:{ok:true,host:c.outgoingHost,port:c.outgoingPort}}}
 async list({limit=20,...extra}={}){const c=this.config(extra);return c.incomingProtocol==="pop3"?listPop3(c,limit):listImap(c,limit)}
 async search({query="",limit=20,...extra}={}){const c=this.config(extra);if(c.incomingProtocol==="pop3"){const rows=await listPop3(c,limit);return{...rows,note:"POP3 search is limited; retrieve messages and search locally for full-text filtering."}}return searchImap(c,query,limit)}
 async read({uid,number,...extra}={}){const c=this.config(extra);return c.incomingProtocol==="pop3"?readPop3(c,number):readImap(c,uid)}
 async send({to,subject,text,html,cc,bcc,attachments,...extra}={}){
  const c=this.config(extra);if(!c.outgoingHost||!c.username||!c.password)return{ok:false,error:"SMTP server, username and password are required."};
  const security=parseSecurity(c.outgoingSecurity,c.outgoingPort),secure=security==="ssl";
  const transporter=nodemailer.createTransport({host:c.outgoingHost,port:c.outgoingPort,secure,auth:{user:c.username,pass:c.password},tls:{rejectUnauthorized:c.rejectUnauthorized!==false}});
  const info=await timeout(transporter.sendMail({from:c.email||c.username,to,cc,bcc,subject,text,html,attachments}));
  return {ok:true,messageId:info.messageId||null,accepted:info.accepted,rejected:info.rejected,response:info.response};
 }
}
module.exports={EmailService,normalizeConfig};