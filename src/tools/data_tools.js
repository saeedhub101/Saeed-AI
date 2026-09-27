// data tool handlers. This module owns only data capability dispatch.
async function handle(registry,n,a){
 if(n==="inspect_database")return registry.dbAdapter.inspect(a.filePath);
  
 if(n==="read_database_query")return registry.dbAdapter.readSqlite(a.filePath,a.sql);
  
 if(n==="pump_normalize_record")return registry.pumpCatalog.normalize(a);
  
 if(n==="pump_map_database_schema")return registry.pumpSchemaMapper.mapTable(a.table,a.columns);
  
 if(n==="pump_map_application_ui")return registry.appUIMapper.plan(a.elements,a.target||{});
  
 if(n==="pump_create_import_plan")return registry.pumpImportPlanner.plan(a.record,a.target,a.mapping);
  
 return undefined;
}
module.exports={handle};
