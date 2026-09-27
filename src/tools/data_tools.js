// data tool handlers. This module owns only data capability dispatch.
async function handle(registry,n,a){
 if(n==="inspect_database")return this.dbAdapter.inspect(a.filePath);
  
 if(n==="read_database_query")return this.dbAdapter.readSqlite(a.filePath,a.sql);
  
 if(n==="pump_normalize_record")return this.pumpCatalog.normalize(a);
  
 if(n==="pump_map_database_schema")return this.pumpSchemaMapper.mapTable(a.table,a.columns);
  
 if(n==="pump_map_application_ui")return this.appUIMapper.plan(a.elements,a.target||{});
  
 if(n==="pump_create_import_plan")return this.pumpImportPlanner.plan(a.record,a.target,a.mapping);
  
 return undefined;
}
module.exports={handle};
