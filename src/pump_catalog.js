class PumpCatalog{
  constructor(){this.required=["model"];this.numeric=["flow","head","power","rpm","efficiency","temperature","weight","length","width","height","diameter"]}
  number(v){
    if(v===null||v===undefined||v==="")return null;
    if(typeof v==="number")return Number.isFinite(v)?v:null;
    const m=String(v).replace(/,/g,".").match(/-?\d+(?:\.\d+)?/);
    return m?Number(m[0]):null;
  }
  source(s){
    if(!s)return null;
    return {file:s.file||null,page:s.page??null,region:s.region||null,type:s.type||"unknown",note:s.note||null};
  }
  normalize(input={}){
    const x=input||{}, out={
      schemaVersion:"pump-record-1",
      manufacturer:x.manufacturer||null,series:x.series||null,model:x.model||null,
      productCode:x.productCode||x.partNumber||null,description:x.description||null,units:x.units||{},
      operating:{flow:this.number(x.flow),head:this.number(x.head),pressure:this.number(x.pressure),power:this.number(x.power),rpm:this.number(x.rpm),efficiency:this.number(x.efficiency),temperature:this.number(x.temperature)},
      dimensions:{length:this.number(x.length),width:this.number(x.width),height:this.number(x.height),diameter:this.number(x.diameter),connection:x.connection||null},
      motor:{power:this.number(x.motorPower),rpm:this.number(x.motorRpm),voltage:x.voltage||null,frequency:x.frequency||null},
      materials:x.materials||{},
      curve:Array.isArray(x.curve)?x.curve.map(p=>({flow:this.number(p.flow),head:this.number(p.head),power:this.number(p.power),efficiency:this.number(p.efficiency)})).filter(p=>p.flow!==null||p.head!==null):[],
      sources:Array.isArray(x.sources)?x.sources.map(s=>this.source(s)).filter(Boolean):[],
      uncertainties:Array.isArray(x.uncertainties)?x.uncertainties:[],confidence:x.confidence||null
    };
    const missing=[];if(!out.model)missing.push("model");if(!out.sources.length)missing.push("sources");
    const warnings=[];if(out.operating.flow===null)warnings.push("flow_missing");if(out.operating.head===null)warnings.push("head_missing");if(out.operating.power===null)warnings.push("power_missing");if(!out.curve.length)warnings.push("performance_curve_not_structured");if(out.dimensions.length===null&&out.dimensions.width===null&&out.dimensions.height===null)warnings.push("dimensions_missing");
    return {ok:missing.length===0,record:out,validation:{missing,warnings}};
  }
}
module.exports={PumpCatalog};