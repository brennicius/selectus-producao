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
 return SelectusReconciliationModel.parse([{sheet:'Dados Brutos',grid}]);
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
   const rows=parsed.rows.filter(r=>SelectusReconciliationModel.productId(r.product,products,mapping));
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

/* Shared pure model: lot codes keep letters (26O16 is not 26016). */
const SelectusReconciliationModel=(()=>{
 const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
 const lot=v=>String(v??'').trim().toUpperCase();
 const date=(value,date1904=false)=>{if(typeof value==='number')return new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+Math.floor(value)*86400000).toISOString().slice(0,10);const s=String(value??'').trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:s.slice(0,10);};
 function parse(sheets){
  const source=sheets.find(s=>norm(s.sheet)==='DADOS BRUTOS')||sheets.find(s=>norm(s.sheet)==='RELATORIO DE LOTES');
  if(!source)throw Error('Não encontrei Dados Brutos ou Relatório de Lotes.');
  const raw=norm(source.sheet)==='DADOS BRUTOS',header=source.grid[0]?.map(c=>norm(c?.value));
  const expected=raw?['DATA','HORA','LOCAL','TIPO','CATEGORIA/MAQUINA','PRODUTO','QUANTIDADE','LOTE']:['DATA','LOCAL','PRODUTO','LOTE','QTD DESCARTADA'];
  if(expected.some((h,i)=>header?.[i]!==h))throw Error('Os cabeçalhos da aba '+source.sheet+' foram alterados.');
  const rows=[];
  source.grid.slice(1).forEach((r,index)=>{
   if(!r)return;const v=i=>r[i]?.value??'';
   if(raw&&norm(v(3))!=='DESCARTE')return;
   if(!raw&&[0,1,2,3,4].every(i=>v(i)===''))return;
   const product=String(v(raw?5:2)).trim(),store=String(v(raw?2:1)).trim(),quantity=v(raw?6:4),d=date(v(0),source.date1904),batch=String(v(raw?7:3)).trim();
   if(!product||!store||!Number.isSafeInteger(quantity)||quantity<0||quantity>999999||!/^\d{4}-\d{2}-\d{2}$/.test(d)||isNaN(Date.parse(d)))throw Error(`Linha ${index+2}: descarte inválido. Confira produto, local, data e quantidade.`);
   if([0,raw?2:1,raw?5:2,raw?6:4,raw?7:3].some(i=>r[i]?.formula))throw Error(`Linha ${index+2}: a origem contém fórmula; envie valores dos registros.`);
   rows.push({date:d,store,product,quantity,lot:batch});
  });
  if(!rows.length)throw Error('Nenhum registro de descarte encontrado.');return {rows,sheet:source.sheet};
 }
 const aliases={
 'MIX DE FRUTAS UVA E MANGA - 150G':'MIX DE FRUTAS UVA E MANGA',
 'SALADA CAESAR GOURMET - N':'SALADA CAESAR GOURMET',
 'SALADA TERIYAKI COM PROTEINA - N':'SALADA TERIYAKI COM PROTEINA',
 'SALADA DE FRANGO + PROTEINA':'SALADA PEITO DE FRANGO + PROTEINA',
 'SANDUICHE DE FRANGO DEFUMADO':'SANDUICHE FRANGO DEFUMADO GOURMET',
 'SANDUICHE DE PERNIL ARTESANAL':'SANDUICHE PERNIL ARTESANAL'
 };
 function productId(name,products,mapping={}){const key=norm(name);if(mapping[key]&&products.some(p=>p.id===mapping[key]))return mapping[key];const target=aliases[key]||key,exact=products.filter(p=>norm(p.name)===target);return exact.length===1?exact[0].id:null;}
 function storeId(name,pdvs){const key=norm(name).replace(/\s/g,'');const i=pdvs.findIndex(p=>norm(p).replace(/\s/g,'')===key);return i<0?null:i;}
 function compare(plans,shipments,source,products,pdvs){
  const groups=new Map(),pending=[],ignored=[];const get=(l,p,s)=>{const k=JSON.stringify([lot(l),p,s]);if(!groups.has(k))groups.set(k,{lot:lot(l),product:p,store:s,sent:0,missing:0,discarded:0,records:0,hasShipment:false});return groups.get(k);};
  const lookup=new Map(shipments.map(x=>[JSON.stringify([x.plan_id,x.product_id,x.store_no]),x.quantity]));
  for(const p of plans)for(const product of products)for(let i=0;i<pdvs.length;i++){
   const sent=lookup.get(JSON.stringify([p.id,product.id,i])),planned=p.values?.[product.id]?.[i]??0,actual=p.actual?.[product.id]?.[i]??null;
   if(sent===undefined&&!planned&&(actual===null||actual===0))continue;
   const g=get(p.lot,product.id,i);if(sent===undefined)g.missing++;else{g.sent+=sent;g.hasShipment=true;}
  }
  for(const row of source?.rows||[]){const p=productId(row.product,products,source.mapping),s=storeId(row.store,pdvs);if(!p){ignored.push(row);continue;}if(!lot(row.lot)||s===null){pending.push({...row,issue:!lot(row.lot)?'Sem lote':!p?'Produto não associado':'Local não cadastrado'});continue;}const g=get(row.lot,p,s);g.discarded+=row.quantity;g.records++;}
  return {rows:[...groups.values()].map(g=>({...g,complete:g.hasShipment&&g.missing===0,balance:g.hasShipment&&g.missing===0?g.sent-g.discarded:null,rate:g.hasShipment&&g.missing===0&&g.sent>0?g.discarded/g.sent*100:null})).sort((a,b)=>b.lot.localeCompare(a.lot)||a.store-b.store||a.product.localeCompare(b.product)),pending,ignored};
 }
 return {norm,lot,parse,productId,storeId,compare};
})();
if(typeof module!=='undefined')module.exports=Reconciliation;
