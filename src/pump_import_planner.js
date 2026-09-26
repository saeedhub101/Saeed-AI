class PumpImportPlanner{
  plan(record, target={}, mapping={}){
    const r=record||{}, fields=mapping.fields||{}, unresolved=[];
    const values={};
    for(const [field,meta] of Object.entries(fields)){
      const value=this.lookup(r,field);
      if(value===null||value===undefined||value==="")unresolved.push({field,column:meta.column||null,reason:"missing_value"});
      else values[field]={column:meta.column||null,value};
    }
    if(!r.model)unresolved.push({field:"model",reason:"missing_model"});
    const sources=Array.isArray(r.sources)?r.sources:[];
    return {schemaVersion:"pump-import-plan-1",mode:"dry_run",target:{application:target.application||null,database:target.database||null,table:target.table||null},values,unresolved,provenance:sources,ready:unresolved.length===0&&Object.keys(values).length>0};
  }
  lookup(r,f){
    if(f==="model")return r.model;
    if(["flow","head","power","rpm","efficiency","temperature"].includes(f))return r.operating?.[f]??null;
    if(["length","width","height","diameter"].includes(f))return r.dimensions?.[f]??null;
    if(["voltage","frequency"].includes(f))return r.motor?.[f]??null;
    return null;
  }
}
module.exports={PumpImportPlanner};