// email tool handlers. This module owns only email capability dispatch.
async function handle(registry,n,a){
 if(n==="email_test_connection")return registry.email.test();
  
 if(n==="email_list")return registry.email.list({limit:Number(a.limit||20)});
  
 if(n==="email_search")return registry.email.search({query:String(a.query||""),limit:Number(a.limit||20)});
  
 if(n==="email_read")return registry.email.read({uid:a.uid,number:a.number});
  
 if(n==="email_send")return registry.email.send({to:a.to,subject:a.subject,text:a.text,html:a.html,cc:a.cc,bcc:a.bcc});
  
 return undefined;
}
module.exports={handle};
