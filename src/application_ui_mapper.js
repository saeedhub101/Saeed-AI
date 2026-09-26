class ApplicationUIMapper{
  normalize(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
  scoreElement(el,aliases=[]){
    const text=this.normalize([el.name,el.automationId,el.controlType,el.value].join(" "));
    const hits=aliases.filter(a=>text.includes(this.normalize(a)));
    return {score:hits.length,hits};
  }
  map(elements=[],fieldAliases={}){
    const fields={},unmapped=[];
    for(const [field,aliases] of Object.entries(fieldAliases)){
      const candidates=elements.map((el,index)=>({index,element:el,...this.scoreElement(el,aliases)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
      if(candidates.length){
        const best=candidates[0];
        fields[field]={index:best.index,name:best.element.name||"",automationId:best.element.automationId||"",controlType:best.element.controlType||"",score:best.score,hits:best.hits,confidence:best.score>=2?"high":"medium"};
      }else unmapped.push(field);
    }
    return {fields,unmapped,ready:unmapped.length===0};
  }
  plan(elements,target={}){
    const aliases={
      model:["model","pump model","type","designation"],
      flow:["flow","flow rate","capacity","q"],
      head:["head","pressure head","h"],
      power:["power","motor power","kw","hp"],
      rpm:["rpm","speed"],
      efficiency:["efficiency","eta"],
      length:["length","overall length"],
      width:["width"],
      height:["height"],
      diameter:["diameter","dia"],
      voltage:["voltage","volt"],
      frequency:["frequency","hz"]
    };
    const mapped=this.map(elements,aliases);
    return {schemaVersion:"pump-ui-map-1",mode:"read_only",target,fields:mapped.fields,unmapped:mapped.unmapped,ready:mapped.ready};
  }
}
module.exports={ApplicationUIMapper};