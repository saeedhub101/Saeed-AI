// email tool handlers. This module owns only email capability dispatch.
async function handle(registry,n,a){
 if(n==="email_test_connection")return this.email.test();
  
 if(n==="email_list")return this.email.list({limit:Number(a.limit||20)});
  
 if(n==="email_search")return this.email.search({query:String(a.query||""),limit:Number(a.limit||20)});
  
 if(n==="email_read")return this.email.read({uid:a.uid,number:a.number});
  
 if(n==="email_send")return this.email.send({to:a.to,subject:a.subject,text:a.text,html:a.html,cc:a.cc,bcc:a.bcc});
  
 return undefined;
}
module.exports={handle};
