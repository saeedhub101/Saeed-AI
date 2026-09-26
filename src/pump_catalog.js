const UNIT={flow:{lps:1,m3h:1/3.6,gpm:0.0630901964},head:{m:1,ft:0.3048},power:{kw:1,hp:0.745699872,w:0.001},pressure:{bar:1,psi:0.0689475729,kpa:0.01},temperature:{c:1,f:v=>(v-32)*5/9},length:{mm:0.001,cm:0.01,m:1,in:0.0254,ft:0.3048}};
class PumpCatalog{
  number(v){
    if(v===null||v===undefined||v==="")return null;
    if(typeof v==="number")return Number.isFinite(v)?v:null;
    const s=String(v).replace(/,/g,".");
    const m=s.match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;
  }
  unit(u){return String(u||"").trim().toLowerCase().replace(/³/g,"3").replace(/\s+/g,"").replace(/\/h$/,"/h")}
  convert(value,unit,target){
    const n=this.number(value),u=this.unit(unit),t=this.unit(target);
    if(n===null)return null;if(u===t||!u)return n;
    if(target==="C"&&u==="f")return (n-32)*5/9;
    const groups=[["flow",["l/s","lps","m3/h","m3h","gpm"]],["head",["m","ft"]],["power",["kw","hp","w"]],["pressure",["bar","psi","kpa"]],["temperature",["c","f"]],["length",["mm","cm","m","in","ft"]]];
    for(const [kind,units] of groups)if((units.includes(u)&&units.includes(t))){
      const base=(u==="m3/h"?n/3.6:u==="gpm"?n*0.0630901964:u==="ft"?n*0.3048:u==="kw"?n:u==="hp"?n*0.745699872:u==="w"?n/1000:u==="psi"?n*0.0689475729:u==="kpa"?n*0.01:u==="mm"?n*0.001:u==="cm"?n*0.01:u==="in"?n*0.0254:n);
      if(kind==="flow")return t==="m3/h"?base*3.6:t==="gpm"?base/0.0630901964:base;
      if(kind==="head")return t==="ft"?base/0.3048:base;
      if(kind==="power")return t==="hp"?base/0.745699872:t==="w"?base*1000:base;
      if(kind==="pressure")return t==="psi"?base/0.0689475729:t==="kpa"?base*100:base;
      if(kind==="length")return t==="mm"?base*1000:t==="cm"?base*100:t==="in"?base/0.0254:t==="ft"?base/0.3048:base;
    }
    return null;
  }
  source(s){
    if(!s)return null;
    return {file:s.file||null,page:s.page??null,region:s.region||null,type:s.type||"unknown",note:s.note||null};
  }
  normalize(input={}){
    const x=input||{}, u=x.units||{};
    const out={schemaVersion:"pump-record-1",manufacturer:x.manufacturer||null,series:x.series||null,model:x.model||null,productCode:x.productCode||x.partNumber||null,description:x.description||null,units:{flow:"m3/h",head:"m",power:"kW",pressure:"bar",temperature:"C",dimensions:"mm"},
      operating:{flow:this.convert(x.flow,u.flow,"m3/h"),head:this.convert(x.head,u.head,"m"),pressure:this.convert(x.pressure,u.pressure,"bar"),power:this.convert(x.power,u.power,"kW"),rpm:this.number(x.rpm),efficiency:this.number(x.efficiency),temperature:this.convert(x.temperature,u.temperature,"C")},
      dimensions:{length:this.convert(x.length,u.length,"mm"),width:this.convert(x.width,u.length,"mm"),height:this.convert(x.height,u.length,"mm"),diameter:this.convert(x.diameter,u.length,"mm"),connection:x.connection||null},
      motor:{power:this.convert(x.motorPower,u.power,"kW"),rpm:this.number(x.motorRpm),voltage:x.voltage||null,frequency:x.frequency||null},materials:x.materials||{},
      curve:Array.isArray(x.curve)?x.curve.map(p=>({flow:this.convert(p.flow,p.flowUnit||u.flow,"m3/h"),head:this.convert(p.head,p.headUnit||u.head,"m"),power:this.convert(p.power,p.powerUnit||u.power,"kW"),efficiency:this.number(p.efficiency),source:this.source(p.source)})).filter(p=>p.flow!==null||p.head!==null):[],
      sources:Array.isArray(x.sources)?x.sources.map(s=>this.source(s)).filter(Boolean):[],uncertainties:Array.isArray(x.uncertainties)?x.uncertainties:[],confidence:x.confidence||null};
    const missing=[];if(!out.model)missing.push("model");if(!out.sources.length)missing.push("sources");
    const warnings=[];if(out.operating.flow===null)warnings.push("flow_missing");if(out.operating.head===null)warnings.push("head_missing");if(out.operating.power===null)warnings.push("power_missing");if(!out.curve.length)warnings.push("performance_curve_not_structured");if(out.dimensions.length===null&&out.dimensions.width===null&&out.dimensions.height===null)warnings.push("dimensions_missing");
    if(out.operating.efficiency!==null&&(out.operating.efficiency<0||out.operating.efficiency>100))warnings.push("efficiency_out_of_range");
    for(const p of out.curve)if(p.flow!==null&&p.head!==null&&p.flow<0)warnings.push("curve_negative_flow");
    return {ok:missing.length===0,record:out,validation:{missing,warnings}};
  }
}
module.exports={PumpCatalog};