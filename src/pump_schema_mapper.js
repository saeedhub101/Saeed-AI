class PumpSchemaMapper{
  constructor(){this.aliases={
    model:["model","model_no","model_number","pump_model","type","designation","product_code"],
    flow:["flow","flow_rate","capacity","q","q_m3h","q_m3_h"],
    head:["head","head_m","head_ft","pressure_head","h"],
    power:["power","motor_power","kw","power_kw","motor_kw","hp"],
    rpm:["rpm","speed","speed_rpm"],
    efficiency:["efficiency","eta","eff","eff_pct"],
    temperature:["temperature","temp","max_temp"],
    length:["length","l","overall_length"],
    width:["width","w"],
    height:["height","hgt","overall_height"],
    diameter:["diameter","dia","d"],
    voltage:["voltage","volt","v"],
    frequency:["frequency","hz","freq"]
  };}
  norm(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
  mapColumns(columns=[]){
    const result={},unmapped=[];
    for(const col of columns){
      const name=typeof col==="string"?col:col.column_name||col.name||"";
      const n=this.norm(name);let field=null;
      for(const [k,aliases] of Object.entries(this.aliases)){
        if(aliases.includes(n)){field=k;break;}
      }
      if(field&&!result[field])result[field]={column:name,confidence:"high"};
      else if(!field)unmapped.push(name);
    }
    return {fields:result,unmapped};
  }
  mapTable(table,columns=[]){
    const mapped=this.mapColumns(columns);
    const score=Object.keys(mapped.fields).length;
    return {table,score,fields:mapped.fields,unmapped:mapped.unmapped,ready:score>=1&&Boolean(mapped.fields.model)};
  }
}
module.exports={PumpSchemaMapper};