/* Shared pure model: lot codes keep letters (26O16 is not 26016). */
const Reconciliation=(()=>{
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
