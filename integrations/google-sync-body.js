/**
 * @OnlyCurrentDoc
 * Cole o arquivo selectus-google-sync.gs completo em um NOVO arquivo do Apps Script
 * vinculado à planilha Contagem Café e Descarte APP. Não substitua scripts existentes.
 * Execute instalarSincronizacaoSelectus uma vez e autorize a leitura e o envio ao banco.
 * A planilha não é editada. O site continua sem login.
 */
const SELECTUS_SYNC={
 spreadsheet:'15WlOrPp0BTW_7HBxOdUWPge3pirdYOLMCQWuvAm324w',
 url:'https://zrljrjyblnclauxjpvdy.supabase.co/rest/v1/',
 key:'sb_publishable_fMp2pAcRUoNG71msVW4KFQ_kS6Mmm3o'
};
function selectusRequest_(path,body){
 const response=UrlFetchApp.fetch(SELECTUS_SYNC.url+path,{method:body===undefined?'get':'post',headers:{apikey:SELECTUS_SYNC.key},contentType:'application/json',...(body===undefined?{}:{payload:JSON.stringify(body)}),muteHttpExceptions:true});
 const text=response.getContentText(),status=response.getResponseCode();let data;try{data=JSON.parse(text);}catch(e){throw Error('Resposta inválida do banco ('+status+').');}
 if(status<200||status>=300)throw Error(data.message||'Falha na sincronização ('+status+').');return data;
}
function selectusSyncData_(values,timezone){
 const grid=values.map(row=>row.map(value=>({value:value instanceof Date?Utilities.formatDate(value,timezone,'yyyy-MM-dd'):value})));
 return Reconciliation.parse([{sheet:'Dados Brutos',grid}]);
}
function sincronizarDescartesSelectus(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  const book=SpreadsheetApp.getActiveSpreadsheet();
  if(!book||book.getId()!==SELECTUS_SYNC.spreadsheet)throw Error('Instale este código na planilha Contagem Café e Descarte APP original.');
  const sheet=book.getSheetByName('Dados Brutos');if(!sheet)throw Error('A aba Dados Brutos não foi encontrada.');
  const count=sheet.getLastRow();if(count<2||count>10001)throw Error('A origem precisa ter entre 1 e 10000 registros.');
  const parsed=selectusSyncData_(sheet.getRange(1,1,count,8).getValues(),book.getSpreadsheetTimeZone());
  const configs=selectusRequest_('production_config?select=data&id=eq.true');
  const products=configs[0]?.data?.catalog?.flatMap(c=>c.products);if(!products?.length)throw Error('Catálogo da produção indisponível.');
  for(let attempt=0;attempt<3;attempt++){
   const previous=selectusRequest_('production_waste_source?select=*&id=eq.true')[0];
   const mapping=previous?.data?.mapping||{};
   const rows=parsed.rows.filter(r=>Reconciliation.productId(r.product,products,mapping));
   if(!rows.length)throw Error('Nenhum descarte dos nossos produtos encontrado. A cópia anterior foi preservada.');
   // Preserve every source row for our products, including missing lots for visible reconciliation.
   const data={rows,sheet:parsed.sheet,filename:'Contagem Café e Descarte APP · Google Sheets',mapping,origin:'google-sheets',sourceId:SELECTUS_SYNC.spreadsheet};
   if(previous?.data?.origin==='google-sheets'&&JSON.stringify(previous.data.rows.map(r=>[r.date,r.store,r.product,r.quantity,r.lot]))===JSON.stringify(rows.map(r=>[r.date,r.store,r.product,r.quantity,r.lot])))return;
   try{
    selectusRequest_('rpc/production_operations',{action:'waste',body:{revision:previous?.revision||0,data}});
    console.log('Selectus: '+rows.length+' descartes sincronizados; '+(parsed.rows.length-rows.length)+' registros fora da produção ignorados.');return;
   }catch(error){if(!String(error.message).includes('CONFLICT')||attempt===2)throw error;}
  }
 }finally{lock.releaseLock();}
}
function instalarSincronizacaoSelectus(){
 sincronizarDescartesSelectus();
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sincronizarDescartesSelectus'))ScriptApp.newTrigger('sincronizarDescartesSelectus').timeBased().everyMinutes(5).create();
 console.log('Selectus: sincronização instalada a cada 5 minutos. Não é necessário manter a planilha aberta.');
}
function pararSincronizacaoSelectus(){
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sincronizarDescartesSelectus').forEach(t=>ScriptApp.deleteTrigger(t));
}
