const uuid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
const PDVS=['Portugues','Amaro','Izabel','Agnus','CRIS','Amaro2'];
const DEFAULT_PDVS=[...PDVS], DEFAULT_CATALOG=structuredClone(CATALOG), CONFIG='selectus-catalog-v2';
try{const cfg=JSON.parse(localStorage.getItem(CONFIG)||'null');if(cfg){PDVS.splice(0,PDVS.length,...cfg.pdvs);CATALOG.splice(0,CATALOG.length,...cfg.catalog);}}catch{}
const $=s=>document.querySelector(s), KEY='selectus-production-v1', DRAFT='selectus-draft-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const fresh=()=>({id:uuid(),date:today(),lot:'',values:{},actual:{}});
const toast=t=>{ $('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',3500);};
let plans=[],plan=fresh(),filter='Todas';
try{plans=JSON.parse(localStorage.getItem(KEY)||'[]');plan=JSON.parse(localStorage.getItem(DRAFT)||'null')||fresh();}catch{toast('Não foi possível recuperar os dados locais.');}
plan.actual??={};
let workMode='planning',pendingImport=null,accessProfile=null;
function persistDraft(){try{localStorage.setItem(DRAFT,JSON.stringify(plan));$('#saveState').textContent='Rascunho salvo neste navegador';}catch{toast('Não foi possível salvar. Exporte um backup.');}}
const quantities=p=>PDVS.map((_,i)=>Number(plan.values[p.id]?.[i])||0);
const sum=a=>a.reduce((x,y)=>x+y,0);
const produced=(cat,n)=>cat==='Sobremesas'?Math.ceil(n/5)*5:n;
function totals(){let requested=0,production=0,pdvs=PDVS.map(()=>0);CATALOG.forEach(c=>c.products.forEach(p=>{const q=quantities(p);requested+=sum(q);production+=produced(c.name,sum(q));q.forEach((v,i)=>pdvs[i]+=v);}));return{requested,production,pdvs};}
const actualValues=p=>PDVS.map((_,i)=>plan.actual?.[p.id]?.[i]??null);
const actualSum=p=>sum(actualValues(p).map(n=>n??0));
function actualTotals(){let actual=0,filled=0,expected=0;const pdvs=PDVS.map(()=>0);CATALOG.forEach(c=>c.products.forEach(p=>{const q=quantities(p),a=actualValues(p);a.forEach((n,i)=>{actual+=n??0;pdvs[i]+=n??0;if(q[i]>0){expected++;if(n!==null)filled++;}});}));return {actual,filled,expected,pdvs};}
function summaryCells(products){const planned=PDVS.map(()=>0),actual=PDVS.map(()=>0);let target=0;products.forEach(p=>{const q=quantities(p),a=actualValues(p);q.forEach((n,i)=>planned[i]+=n);a.forEach((n,i)=>actual[i]+=n??0);});const n=sum(planned),a=sum(actual);return planned.map((n,i)=>`<td>${n}</td><td class="actual-cell">${actual[i]}</td>`).join('')+`<td>${n}</td><td>${a}</td><td class="${a<n?'negative':'positive'}">${a-n>0?'+':''}${a-n}</td>`;}
function refreshNumbers(){updateStats();CATALOG.forEach(c=>{const visible=c.products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes($('#search').value.toLocaleLowerCase('pt-BR')));const sub=[...document.querySelectorAll('[data-sub]')].find(r=>r.dataset.sub===c.name);if(sub)sub.innerHTML=`<td>Subtotal · ${esc(c.name)}</td>`+summaryCells(visible);c.products.forEach(p=>{const row=document.querySelector(`[data-product="${p.id}"]`);if(!row)return;const q=sum(quantities(p)),a=actualSum(p),complete=actualValues(p).some(n=>n!==null);row.querySelector('[data-total-planned]').textContent=q;row.querySelector('[data-total-actual]').textContent=complete?a:'—';const delta=row.querySelector('[data-delta]');delta.textContent=complete?(a-q>0?'+':'')+(a-q):'—';delta.className='total '+(complete&&a<q?'negative':'');});});const grand=$('tfoot tr');if(grand)grand.innerHTML='<td>Total geral do plano</td>'+summaryCells(CATALOG.flatMap(c=>c.products));}
function render(){
 if(accessProfile==='kitchen')renderKitchen();
 $('#date').value=plan.date;$('#lot').value=plan.lot;
 $('#workStage').textContent=accessProfile==='kitchen'?'Apontar produção · Josué / Cozinha':accessProfile==='admin'?'Editar planejamento · ADM':'Escolha seu perfil';$('#date').disabled=workMode==='actual';$('#lot').disabled=workMode==='actual';
 $('#tabs').innerHTML=['Todas',...CATALOG.map(c=>c.name)].map(n=>`<button class="${filter===n?'active':''}" data-category="${esc(n)}">${esc(n)}</button>`).join('');
 const search=$('#search').value.toLocaleLowerCase('pt-BR');let count=0;let body='';
 CATALOG.filter(c=>filter==='Todas'||filter===c.name).forEach(c=>{const products=c.products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(search));if(!products.length)return;count+=products.length;
 body+=`<tr class="category"><th colspan="${PDVS.length*2+4}">${esc(c.name.toUpperCase())} <span> · ${products.length} produtos</span></th></tr>`;
 products.forEach(p=>{const q=quantities(p),a=actualValues(p);body+=`<tr data-product="${p.id}"><td>${esc(p.name)}</td>${q.map((v,i)=>`<td><input type="number" min="0" max="999999" step="1" inputmode="numeric" data-id="${p.id}" data-pdv="${i}" data-kind="planned" value="${v||''}" placeholder="0" ${workMode==='actual'?'readonly':''} aria-label="${esc(p.name)} — ${esc(PDVS[i])} — Planejado"></td><td class="actual-cell"><input type="number" min="0" max="999999" step="1" inputmode="numeric" data-id="${p.id}" data-pdv="${i}" data-kind="actual" value="${a[i]??''}" placeholder="—" ${workMode==='planning'?'readonly':''} aria-label="${esc(p.name)} — ${esc(PDVS[i])} — Produzido"></td>`).join('')}<td class="total" data-total-planned></td><td class="total" data-total-actual></td><td class="total" data-delta></td></tr>`;});
 body+=`<tr class="subtotal" data-sub="${esc(c.name)}"><td>Subtotal</td></tr>`;});
 $('#tables').innerHTML=count?`<table class="comparison-table"><thead><tr><th rowspan="2">Produto</th>${PDVS.map(n=>`<th colspan="2">${esc(n)}</th>`).join('')}<th colspan="3">Totais do produto</th></tr><tr>${PDVS.map(()=>'<th>Planejado</th><th class="actual-cell">Produzido</th>').join('')}<th>Planejado</th><th>Produzido</th><th>Diferença</th></tr></thead><tbody>${body}</tbody><tfoot><tr class="grand"></tr></tfoot></table>`:'<p class="empty">Nenhum produto encontrado.</p>';refreshNumbers();
 $('footer').firstChild.textContent=`${CATALOG.reduce((n,c)=>n+c.products.length,0)} produtos · ${CATALOG.length} categorias · ${PDVS.length} PDVs `;
}
function updateStats(){const t=totals(),a=actualTotals();$('#requested').textContent=t.requested;$('#production').textContent=t.production;$('#actualTotal').textContent=a.actual;$('#actualProgress').textContent=`${a.filled} de ${a.expected} apontamentos previstos preenchidos`;$('#destinations').innerHTML=`${t.pdvs.filter(n=>n>0).length} <em>/ ${PDVS.length}</em>`;}
$('#tables').addEventListener('input',e=>{const el=e.target;if(!el.matches('input[data-id]'))return;if(!el.validity.valid){el.reportValidity();return;}const id=el.dataset.id,i=Number(el.dataset.pdv);if(el.dataset.kind==='actual'){plan.actual??={};plan.actual[id]=PDVS.map((_,j)=>plan.actual[id]?.[j]??null);plan.actual[id][i]=el.value===''?null:Number(el.value);}else{plan.values[id]=PDVS.map((_,j)=>Number(plan.values[id]?.[j])||0);plan.values[id][i]=Number(el.value)||0;}persistDraft();refreshNumbers();});

$('#date').onchange=e=>{plan.date=e.target.value;persistDraft();};$('#lot').oninput=e=>{plan.lot=e.target.value;persistDraft();};
$('#search').oninput=render;$('#tabs').onclick=e=>{if(e.target.dataset.category){filter=e.target.dataset.category;render();}};
function editor(){ $('#manage').hidden=true;$('#manageNav').classList.remove('active');$('#editor').hidden=false;$('#history').hidden=true;$('#planNav').classList.add('active');$('#historyNav').classList.remove('active');$('h1').textContent='Plano de produção';render(); }
$('#planNav').onclick=editor;
$('#newPlan').onclick=()=>{if((sum(Object.values(plan.values).flat())>0||sum(Object.values(plan.actual||{}).flat().map(n=>n??0))>0)&&!confirm('Abrir um novo plano? Salve o plano atual no histórico antes de continuar.'))return;plan=fresh();filter='Todas';$('#search').value='';persistDraft();editor();};
$('#example').onclick=()=>{if(workMode==='actual'){toast('Mude para Editar planejamento para carregar o exemplo.');return;}if(!confirm('Carregar as quantidades de exemplo da planilha e substituir o rascunho atual?'))return;CATALOG.forEach(c=>c.products.forEach(p=>plan.values[p.id]=PDVS.map((_,i)=>p.example?.[i]||0)));persistDraft();render();};
$('#save').onclick=()=>{if(!plan.date||!plan.lot.trim()){toast('Preencha a data de produção e o lote.');(!plan.date?$('#date'):$('#lot')).focus();return;}if([...document.querySelectorAll('input[type=number]')].some(e=>!e.validity.valid)){toast('Corrija as quantidades inválidas antes de salvar.');return;}const saved={...structuredClone(plan),lot:plan.lot.trim(),updatedAt:new Date().toISOString()};const next=plans.filter(p=>p.id!==plan.id).concat([saved]);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;$('#saveState').textContent='Plano salvo no histórico';toast('Plano salvo no histórico.');}catch{toast('Falha ao salvar. Baixe um backup.');}};
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const csvCell=v=>'"'+String(v).replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
$('#csv').onclick=()=>{const rows=[['Data de produção',plan.date],['Lote',plan.lot],[],['Categoria','Produto','PDV','Planejado','Produzido','Diferença']];CATALOG.forEach(c=>c.products.forEach(p=>{const q=quantities(p),a=actualValues(p);PDVS.forEach((name,i)=>rows.push([c.name,p.name,name,q[i],a[i]??'',a[i]===null?'':a[i]-q[i]]));}));download('selectus-planejado-produzido-'+(plan.date||'plano')+'.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');};
$('#print').onclick=()=>{$('#printClient').innerHTML=PDVS.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('');$('#printDialog').showModal();};
function history(){ $('#manage').hidden=true;$('#manageNav').classList.remove('active');$('#editor').hidden=true;$('#history').hidden=false;$('#planNav').classList.remove('active');$('#historyNav').classList.add('active');$('h1').textContent='Histórico de produção';$('#historyList').innerHTML=plans.length?[...plans].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="history-row"><span><b>${esc(p.date.split('-').reverse().join('/'))} · Lote ${esc(p.lot)}</b><small>${sum(Object.values(p.values).flat())} unidades planejadas · ${sum(Object.values(p.actual||{}).flat().map(n=>n??0))} produzidas</small></span><button data-open="${esc(p.id)}">Abrir plano</button>${accessProfile==='kitchen'?'':`<button data-delete="${esc(p.id)}">Excluir</button>`}</div>`).join(''):'<p class="empty">Nenhum plano salvo ainda. Preencha a data e o lote e clique em Salvar plano.</p>';}
$('#historyNav').onclick=history;$('#historyList').onclick=e=>{if(e.target.dataset.open){if(!confirm('Abrir este plano e substituir o rascunho atual?'))return;plan=structuredClone(plans.find(p=>p.id===e.target.dataset.open));plan.actual??={};persistDraft();editor();}if(e.target.dataset.delete&&confirm('Excluir este plano do histórico?')){const next=plans.filter(p=>p.id!==e.target.dataset.delete);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;history();}catch{toast('Não foi possível excluir.');}}};
function backupData(){return {version:3,pdvs:PDVS,catalog:CATALOG,plans,draft:plan};}
$('#backup').onclick=()=>download('selectus-backup-'+today()+'.json',JSON.stringify(backupData(),null,2),'application/json');
function validPlan(p,ids=new Set(CATALOG.flatMap(c=>c.products.map(p=>p.id))),length=PDVS.length){return p&&typeof p.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(p.id)&&typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!isNaN(Date.parse(p.date))&&typeof p.lot==='string'&&p.lot.length<=80&&p.values&&typeof p.values==='object'&&!Array.isArray(p.values)&&Object.entries(p.values).every(([id,v])=>ids.has(id)&&Array.isArray(v)&&v.length<=length&&v.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=999999))&&(!p.actual||(typeof p.actual==='object'&&!Array.isArray(p.actual)&&Object.entries(p.actual).every(([id,v])=>ids.has(id)&&Array.isArray(v)&&v.length<=length&&v.every(n=>n===null||(Number.isSafeInteger(n)&&n>=0&&n<=999999)))));}
$('#restore').onchange=async e=>{try{
 const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error();const b=JSON.parse(await file.text());
 const names=b.version===1?DEFAULT_PDVS:b.pdvs,cats=b.version===1?DEFAULT_CATALOG:b.catalog;
 if(![1,2,3].includes(b.version)||!Array.isArray(names)||names.length<1||names.length>100||names.some(n=>typeof n!=='string'||!n.trim()||n.length>60)||new Set(names).size!==names.length||!Array.isArray(cats)||cats.length!==5)throw Error();
 const ids=new Set();for(const c of cats){if(!DEFAULT_CATALOG.some(d=>d.name===c.name)||!Array.isArray(c.products))throw Error();for(const p of c.products){if(typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>120)throw Error();ids.add(p.id);}}
 if(!Array.isArray(b.plans)||!b.plans.every(p=>validPlan(p,ids,names.length))||(b.draft&&!validPlan(b.draft,ids,names.length)))throw Error();
 if(!confirm('Importar os cadastros e planos? Planos com o mesmo identificador serão atualizados. O rascunho atual será mantido.'))return;
 const newPdvs=[...PDVS];names.forEach(n=>{if(!newPdvs.includes(n))newPdvs.push(n);});const newCatalog=structuredClone(CATALOG);
 cats.forEach(c=>c.products.forEach(p=>{const existing=newCatalog.flatMap(c=>c.products).find(q=>q.id===p.id);if(existing&&existing.name!==p.name)throw Error('ID de produto em conflito.');if(!existing)newCatalog.find(d=>d.name===c.name).products.push({...p,example:[]});}));
 const merged=new Map(plans.map(p=>[p.id,p]));b.plans.forEach(p=>{const imported=structuredClone(p);for(const id in imported.values){const q=imported.values[id];imported.values[id]=newPdvs.map(n=>q[names.indexOf(n)]||0);}imported.actual??={};for(const id in imported.actual){const q=imported.actual[id];imported.actual[id]=newPdvs.map(n=>q[names.indexOf(n)]??null);}merged.set(p.id,imported);});const next=[...merged.values()];
 localStorage.setItem(CONFIG,JSON.stringify({pdvs:newPdvs,catalog:newCatalog}));localStorage.setItem(KEY,JSON.stringify(next));PDVS.splice(0,PDVS.length,...newPdvs);CATALOG.splice(0,CATALOG.length,...newCatalog);plans=next;history();toast('Cadastros e histórico restaurados.');
 }catch{toast('Backup inválido, conflito de cadastro ou armazenamento indisponível.');}finally{e.target.value='';}};
function persistConfig(pdvs,catalog){try{localStorage.setItem(CONFIG,JSON.stringify({pdvs,catalog}));return true;}catch{toast('Não foi possível salvar o cadastro. Faça um backup.');return false;}}
function manage(){
 $('#editor').hidden=true;$('#history').hidden=true;$('#manage').hidden=false;$('#planNav').classList.remove('active');$('#historyNav').classList.remove('active');$('#manageNav').classList.add('active');$('h1').textContent='Produtos e clientes';
 $('#productCategory').innerHTML=CATALOG.map((c,i)=>`<option value="${i}">${esc(c.name)}</option>`).join('');
 $('#productList').innerHTML=CATALOG.map(c=>`<div class="registry-category"><h3>${esc(c.name)} <small>${c.products.length} produtos</small></h3>${c.products.map(p=>`<div class="registry-item">${esc(p.name)}</div>`).join('')}</div>`).join('');
 $('#clientList').innerHTML=PDVS.map(n=>`<span class="client-chip">${esc(n)}</span>`).join('');
}
$('#manageNav').onclick=manage;
const normalize=n=>n.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
$('#productForm').onsubmit=e=>{e.preventDefault();const name=$('#productName').value.trim(),category=Number($('#productCategory').value);if(!name)return;
 if(CATALOG.some(c=>c.products.some(p=>normalize(p.name)===normalize(name)))){toast('Já existe um produto com esse nome.');return;}
 const next=structuredClone(CATALOG);next[category].products.push({id:uuid(),name:name.toLocaleUpperCase('pt-BR'),example:[]});if(!persistConfig(PDVS,next))return;CATALOG.splice(0,CATALOG.length,...next);$('#productForm').reset();manage();toast('Produto cadastrado.');};
$('#clientForm').onsubmit=e=>{e.preventDefault();const name=$('#clientName').value.trim();if(!name)return;if(PDVS.some(n=>normalize(n)===normalize(name))){toast('Já existe um cliente com esse nome.');return;}if(PDVS.length>=100){toast('Limite de 100 locais atingido.');return;}const next=[...PDVS,name];if(!persistConfig(next,CATALOG))return;PDVS.push(name);$('#clientForm').reset();manage();toast('Cliente cadastrado.');};
$('#printMode').onchange=()=>$('#printClientLabel').hidden=$('#printMode').value!=='one';
function reportHTML(mode,selected,zeros){
 const date=plan.date?plan.date.split('-').reverse().join('/'):'Não informada',indices=mode==='one'?[selected]:mode==='separate'?PDVS.map((_,i)=>i):[null];
 return indices.map(index=>{let totalPlan=0,totalActual=0,missing=0;let tables='';
 CATALOG.forEach(c=>{let subP=0,subA=0;const rows=c.products.map(p=>{const q=quantities(p),a=actualValues(p),req=index===null?sum(q):q[index],act=index===null?sum(a.map(n=>n??0)):(a[index]??0),informed=index===null?a.some(n=>n!==null):a[index]!==null;if(!zeros&&req===0&&act===0)return '';const pending=index===null?q.some((n,i)=>n>0&&a[i]===null):req>0&&a[index]===null;if(pending)missing++;subP+=req;subA+=act;return `<tr><td>${esc(p.name)}</td><td>${req}</td><td>${informed?act:'—'}</td><td>${informed?act-req:'—'}${pending?' *':''}</td><td class="report-check">□</td></tr>`;}).join('');if(!rows)return;totalPlan+=subP;totalActual+=subA;
 tables+=`<h3>${esc(c.name)}</h3><table><thead><tr><th>Produto</th><th>Planejado</th><th>Produzido</th><th>Diferença</th><th>Conferência</th></tr></thead><tbody>${rows}<tr class="report-subtotal"><td>Subtotal</td><td>${subP}</td><td>${subA}</td><td>${subA-subP}</td><td></td></tr></tbody></table>`;});
 return `<article class="report-sheet"><div class="report-header"><div><b class="report-brand">Selectus</b><span>ALIMENTOS · COZINHA CENTRAL</span></div><div><h2>Planejado × Produzido</h2><p>${index===null?'Consolidado · todos os locais':esc(PDVS[index])}</p></div></div><div class="report-meta"><span>Data de produção <b>${esc(date)}</b></span><span>Lote <b>${esc(plan.lot||'Não informado')}</b></span><span>Destino <b>${index===null?'Todos os locais':esc(PDVS[index])}</b></span></div>${tables||'<p class="empty">Nenhum produto previsto ou produzido para este local.</p>'}<div class="report-total"><span>PLANEJADO: ${totalPlan}</span><b>PRODUZIDO: ${totalActual}</b></div><p class="report-note">Diferença = produzido − planejado. “—” indica produção não informada. ${missing?`* ${missing} produtos com apontamentos pendentes. Totais produzidos são parciais.`:'Apontamentos previstos preenchidos.'} ${index===null?'Meta da cozinha: '+totals().production+' unidades (inclui arredondamento de sobremesas). Os valores por PDV são exatos.':''}</p><div class="signatures"><span>Responsável pela produção: ____________________</span><span>Conferência: ____________________</span></div><div class="report-footer">Selectus Alimentos · Cuidar de você é o nosso propósito.</div></article>`;
 }).join('');
}
$('#confirmPrint').onclick=()=>{
 if(!plan.date||!plan.lot.trim()){toast('Preencha data e lote antes de imprimir.');return;}
 if([...document.querySelectorAll('input[data-id],input[data-k-input]')].some(e=>!e.validity.valid)){toast('Corrija as quantidades inválidas antes de imprimir.');return;}
 $('#printReport').innerHTML=reportHTML($('#printMode').value,Number($('#printClient').value),$('#printZeros').checked);$('#printDialog').close();document.body.classList.add('printing-report');window.print();
};
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-report'));
function planTemplate(){return {versao:1,data_producao:today(),lote:'PREENCHER',itens:CATALOG.flatMap(c=>c.products.flatMap(p=>PDVS.map(pdv=>({produto:p.name,pdv,planejado:0}))))};}
$('#planTemplate').onclick=()=>download('modelo-plano-selectus.json',JSON.stringify(planTemplate(),null,2),'application/json');
function parseIncomingPlan(text){
 let b;try{b=JSON.parse(text);}catch{throw Error('JSON inválido. Peça ao Claude um arquivo JSON sem blocos de código.');}
 if(b.versao!==1||typeof b.data_producao!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.data_producao)||isNaN(Date.parse(b.data_producao))||new Date(b.data_producao+'T12:00:00Z').toISOString().slice(0,10)!==b.data_producao)throw Error('Informe data_producao válida no formato AAAA-MM-DD.');
 if(typeof b.lote!=='string'||!b.lote.trim()||b.lote.trim()==='PREENCHER'||b.lote.length>80)throw Error('Informe o lote de produção (até 80 caracteres).');
 if(!Array.isArray(b.itens)||!b.itens.length||b.itens.length>100000)throw Error('A lista itens está vazia ou excede o limite.');
 const next={...fresh(),date:b.data_producao,lot:b.lote.trim(),importedAt:new Date().toISOString()},seen=new Set();let units=0;
 for(let row=0;row<b.itens.length;row++){const item=b.itens[row];if(!item||typeof item.produto!=='string'||typeof item.pdv!=='string')throw Error(`Item ${row+1}: produto e pdv são obrigatórios.`);
 const product=CATALOG.flatMap(c=>c.products).find(p=>normalize(p.name)===normalize(item.produto)),i=PDVS.findIndex(n=>normalize(n)===normalize(item.pdv));
 if(!product)throw Error(`Item ${row+1}: produto não cadastrado: ${item.produto}`);if(i<0)throw Error(`Item ${row+1}: cliente não cadastrado: ${item.pdv}`);
 if(!Number.isSafeInteger(item.planejado)||item.planejado<0||item.planejado>999999)throw Error(`Item ${row+1}: planejado deve ser um número inteiro entre 0 e 999999.`);
 const key=product.id+':'+i;if(seen.has(key))throw Error(`Item ${row+1}: combinação de produto e PDV duplicada.`);seen.add(key);next.values[product.id]??=PDVS.map(()=>0);next.values[product.id][i]=item.planejado;units+=item.planejado;
 }
 return {plan:next,units,rows:b.itens.length};
}
$('#importPlan').onclick=()=>{pendingImport=null;$('#importReview').textContent='';$('#applyImport').disabled=true;$('#importDialog').showModal();};
$('#closeImport').onclick=()=>$('#importDialog').close();
function invalidateImport(){pendingImport=null;$('#applyImport').disabled=true;$('#importReview').textContent='Confira o conteúdo antes de importar.';}
$('#planJSON').oninput=invalidateImport;
$('#planFile').onchange=async e=>{invalidateImport();try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error('O arquivo deve ter até 5 MB.');$('#planJSON').value=await file.text();}catch(err){$('#importReview').textContent=err.message;}finally{e.target.value='';}};
$('#reviewImport').onclick=()=>{try{pendingImport=parseIncomingPlan($('#planJSON').value);$('#importReview').textContent=`Data: ${pendingImport.plan.date.split('-').reverse().join('/')} · Lote: ${pendingImport.plan.lot} · ${pendingImport.rows} linhas · ${pendingImport.units} unidades planejadas. Os campos Produzido começarão em branco.`;$('#applyImport').disabled=false;}catch(err){pendingImport=null;$('#applyImport').disabled=true;$('#importReview').textContent=err.message;}};
$('#applyImport').onclick=()=>{if(!pendingImport)return;if(!confirm('Criar um novo plano importado e substituir o rascunho em tela? Salve o trabalho atual no histórico antes de continuar.'))return;const next=pendingImport.plan,newPlans=[...plans,{...structuredClone(next),updatedAt:new Date().toISOString()}];try{localStorage.setItem(KEY,JSON.stringify(newPlans));localStorage.setItem(DRAFT,JSON.stringify(next));plans=newPlans;plan=next;workMode=accessProfile==='kitchen'?'actual':'planning';filter='Todas';$('#search').value='';$('#importDialog').close();pendingImport=null;editor();toast('Plano importado e salvo. Troque para Josué / Cozinha para apontar a produção.');}catch{toast('Não foi possível concluir. Baixe um backup e tente novamente.');}};
function setProfile(profile){
 accessProfile=profile;document.body.classList.toggle('kitchen-mode',profile==='kitchen');$('#kitchenPanel').hidden=profile!=='kitchen';workMode=profile==='kitchen'?'actual':'planning';
 const kitchen=profile==='kitchen';
 ['newPlan','importPlan','planTemplate','example','manageNav'].forEach(id=>$('#'+id).hidden=kitchen);
 $('#restore').closest('label').hidden=kitchen;
 $('#switchProfile').textContent=(kitchen?'Josué / Cozinha':'ADM')+' · Trocar perfil';
 $('#profileDialog').close();editor();
}
$('#chooseAdmin').onclick=()=>setProfile('admin');
$('#chooseKitchen').onclick=()=>setProfile('kitchen');
$('#switchProfile').onclick=()=>{$('#cancelProfile').hidden=!accessProfile;$('#profileDialog').showModal();};
$('#cancelProfile').onclick=()=>$('#profileDialog').close();
$('#profileDialog').addEventListener('cancel',e=>{if(!accessProfile)e.preventDefault();});
let kitchenView='total',kitchenStore=0;
function kitchenProductMetrics(p,index){const q=quantities(p),a=actualValues(p),planned=index===null?sum(q):q[index],actual=index===null?sum(a.map(n=>n??0)):(a[index]??0),informed=index===null?a.some(n=>n!==null):a[index]!==null;return {planned,actual,informed,missing:index===null?q.some((n,i)=>n>0&&a[i]===null):q[index]>0&&a[index]===null};}
function renderKitchen(){
 kitchenStore=Math.min(kitchenStore,PDVS.length-1);const index=kitchenView==='total'?null:kitchenStore,search=normalize($('#kitchenSearch').value),all=$('#kitchenAll').checked;
 $('#kitchenPlanInfo').textContent=`${plan.date?plan.date.split('-').reverse().join('/'):'Data não informada'} · Lote ${plan.lot||'não informado'}`;
 $('#kitchenStoreLabel').hidden=kitchenView==='total';$('#kitchenStore').innerHTML=PDVS.map((n,i)=>`<option value="${i}" ${i===kitchenStore?'selected':''}>${esc(n)}</option>`).join('');
 [...document.querySelectorAll('.kitchen-menu button')].forEach(b=>{b.classList.toggle('selected',b.dataset.view===kitchenView);b.setAttribute('aria-pressed',b.dataset.view===kitchenView?'true':'false');});
 $('#kitchenSaveBar').hidden=kitchenView!=='record';$('#kitchenSaveLabel').textContent='Produção · '+PDVS[kitchenStore];
 refreshKitchenContext();
 let count=0;$('#kitchenCards').innerHTML=CATALOG.map(c=>{const products=c.products.filter(p=>{const m=kitchenProductMetrics(p,index);return normalize(p.name).includes(search)&&(all||m.planned>0||m.informed);});if(!products.length)return '';count+=products.length;return `<section class="kitchen-category"><h3>${esc(c.name)} <small>${products.length} produtos</small></h3><div class="kitchen-product-grid">${products.map(p=>{const m=kitchenProductMetrics(p,index),target=index===null?produced(c.name,m.planned):m.planned;return `<article class="kitchen-product"><h4>${esc(p.name)}</h4><div class="kitchen-numbers"><span>${index===null?'A produzir':'Planejado'}<b>${target}</b></span><span>Produzido<b data-k-actual="${p.id}">${m.informed?m.actual:'—'}</b></span><span data-k-diff="${p.id}">${m.missing?'Parcial · diferença':'Diferença'}<b>${m.informed?m.actual-target:'—'}</b></span></div>${kitchenView==='record'?`<label class="kitchen-input-label">Quantidade produzida<div class="stepper-touch"><button type="button" data-k-step="-1" data-product-id="${p.id}" aria-label="Diminuir ${esc(p.name)}">−</button><input type="number" min="0" max="999999" step="1" inputmode="numeric" data-k-input="${p.id}" value="${actualValues(p)[index]??''}" placeholder="Não informado" aria-label="Produzido · ${esc(p.name)} · ${esc(PDVS[index])}"><button type="button" data-k-step="1" data-product-id="${p.id}" aria-label="Aumentar ${esc(p.name)}">+</button></div></label><div class="kitchen-quick"><button type="button" data-k-set="${m.planned}" data-product-id="${p.id}">Feito como planejado (${m.planned})</button><button type="button" data-k-set="0" data-product-id="${p.id}">Não produzido (0)</button></div>`:''}</article>`;}).join('')}</div></section>`;}).join('');
 if(!count)$('#kitchenCards').innerHTML='<div class="panel empty">Nenhum produto nesta seleção. Para registrar algo fora do plano, marque “Mostrar também produtos sem pedido”.</div>';
}
function refreshKitchenContext(){const index=kitchenView==='total'?null:kitchenStore;
 const pds=CATALOG.flatMap(c=>c.products);let planned=0,actual=0,pending=0;for(const p of pds){const m=kitchenProductMetrics(p,index);planned+=m.planned;actual+=m.actual;if(m.missing)pending++;}
 $('#kitchenContext').innerHTML=`<div><span>${index===null?'Meta da cozinha':esc(PDVS[index])+' · Planejado'}</span><b>${index===null?totals().production:planned}<small> un.</small></b></div><div><span>Produzido informado</span><b>${actual}<small> un.</small></b></div><div><span>${pending?'Produtos com apontamento pendente':'Apontamentos previstos'}</span><b>${pending||'OK'}</b></div><p>${kitchenView==='total'?'Meta com arredondamento das sobremesas. A distribuição planejada soma '+planned+' unidades.':kitchenView==='record'?'Preencha o que foi feito para esta loja. Vazio = não informado. Zero = nada produzido.':'Quantidades exatas planejadas para esta loja, sem arredondamento.'} ${pending?'O produzido informado ainda é parcial.':''}</p>`;
}
function writeKitchen(id,value){plan.actual??={};plan.actual[id]=PDVS.map((_,i)=>plan.actual[id]?.[i]??null);plan.actual[id][kitchenStore]=value;persistDraft();$('#kitchenSaveState').textContent='Rascunho atualizado. Toque em Salvar produção desta loja para atualizar o histórico.';}
$('.kitchen-menu').onclick=e=>{const b=e.target.closest('button[data-view]');if(!b)return;if([...document.querySelectorAll('[data-k-input]')].some(input=>!input.validity.valid)){toast('Corrija a quantidade inválida antes de mudar a visualização.');return;}kitchenView=b.dataset.view;renderKitchen();};
$('#kitchenStore').onchange=e=>{if([...document.querySelectorAll('[data-k-input]')].some(input=>!input.validity.valid)){e.target.value=String(kitchenStore);toast('Corrija a quantidade inválida antes de trocar de loja.');return;}kitchenStore=Number(e.target.value);renderKitchen();};
$('#kitchenSearch').oninput=renderKitchen;$('#kitchenAll').onchange=renderKitchen;
$('#kitchenHistory').onclick=history;
$('#kitchenPrint').onclick=()=>$('#print').onclick();
$('#kitchenCards').addEventListener('input',e=>{const input=e.target;if(!input.matches('[data-k-input]'))return;if(!input.validity.valid){$('#kitchenSaveState').textContent='Informe uma quantidade inteira entre 0 e 999999.';return;}writeKitchen(input.dataset.kInput,input.value===''?null:Number(input.value));const p=CATALOG.flatMap(c=>c.products).find(p=>p.id===input.dataset.kInput),m=kitchenProductMetrics(p,kitchenStore),card=input.closest('.kitchen-product');card.querySelector('[data-k-actual]').textContent=m.informed?m.actual:'—';refreshKitchenContext();card.querySelector('[data-k-diff]').innerHTML=`${m.missing?'Parcial · diferença':'Diferença'}<b>${m.informed?m.actual-m.planned:'—'}</b>`;});

$('#kitchenCards').addEventListener('click',e=>{const b=e.target.closest('button[data-product-id]');if(!b)return;const input=document.querySelector(`[data-k-input="${b.dataset.productId}"]`);if(input&&!input.validity.valid){input.reportValidity();return;}const old=plan.actual?.[b.dataset.productId]?.[kitchenStore]??0,newValue=b.dataset.kSet!==undefined?Number(b.dataset.kSet):Math.min(999999,Math.max(0,old+Number(b.dataset.kStep)));writeKitchen(b.dataset.productId,newValue);renderKitchen();});
$('#saveKitchen').onclick=()=>{const invalid=[...document.querySelectorAll('[data-k-input]')].find(input=>!input.validity.valid);if(invalid){invalid.reportValidity();toast('Corrija a quantidade inválida antes de salvar.');return;}if(!plan.date||!plan.lot.trim()){toast('O ADM precisa preencher data e lote do plano antes de salvar a produção.');return;}const saved={...structuredClone(plan),updatedAt:new Date().toISOString()};const next=plans.filter(p=>p.id!==plan.id).concat([saved]);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;persistDraft();$('#kitchenSaveState').textContent='Produção salva no histórico deste aparelho.';toast('Produção de '+PDVS[kitchenStore]+' salva.');}catch{toast('Não foi possível salvar. Faça um backup.');}};
render();

$('#profileDialog').showModal();


