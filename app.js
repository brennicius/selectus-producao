const uuid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
const PDVS=['Portugues','Amaro','Izabel','Agnus','CRIS','Amaro2'];
const DEFAULT_PDVS=[...PDVS], DEFAULT_CATALOG=structuredClone(CATALOG), CONFIG='selectus-catalog-v2';
try{const cfg=JSON.parse(localStorage.getItem(CONFIG)||'null');if(cfg){PDVS.splice(0,PDVS.length,...cfg.pdvs);CATALOG.splice(0,CATALOG.length,...cfg.catalog);}}catch{}
const $=s=>document.querySelector(s), KEY='selectus-production-v1', DRAFT='selectus-draft-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const fresh=()=>({id:uuid(),date:today(),lot:'',values:{}});
const toast=t=>{ $('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',3500);};
let plans=[],plan=fresh(),filter='Todas';
try{plans=JSON.parse(localStorage.getItem(KEY)||'[]');plan=JSON.parse(localStorage.getItem(DRAFT)||'null')||fresh();}catch{toast('Não foi possível recuperar os dados locais.');}
function persistDraft(){try{localStorage.setItem(DRAFT,JSON.stringify(plan));$('#saveState').textContent='Rascunho salvo neste navegador';}catch{toast('Não foi possível salvar. Exporte um backup.');}}
const quantities=p=>PDVS.map((_,i)=>Number(plan.values[p.id]?.[i])||0);
const sum=a=>a.reduce((x,y)=>x+y,0);
const produced=(cat,n)=>cat==='Sobremesas'?Math.ceil(n/5)*5:n;
function totals(){let requested=0,production=0,pdvs=PDVS.map(()=>0);CATALOG.forEach(c=>c.products.forEach(p=>{const q=quantities(p);requested+=sum(q);production+=produced(c.name,sum(q));q.forEach((v,i)=>pdvs[i]+=v);}));return{requested,production,pdvs};}
function render(){
 $('#date').value=plan.date;$('#lot').value=plan.lot;
 $('#tabs').innerHTML=['Todas',...CATALOG.map(c=>c.name)].map(n=>`<button class="${filter===n?'active':''}" data-category="${esc(n)}">${esc(n)}</button>`).join('');
 const search=$('#search').value.toLocaleLowerCase('pt-BR');let count=0;
 let body='';CATALOG.filter(c=>filter==='Todas'||filter===c.name).forEach(c=>{
 const products=c.products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(search));if(!products.length)return;count+=products.length;
 const sub=PDVS.map(()=>0);let prod=0,req=0;
 body+=`<tr class="category"><th colspan="${PDVS.length+3}">${esc(c.name.toUpperCase())} <span> · ${products.length} produtos</span></th></tr>`;
 products.forEach(p=>{const q=quantities(p),n=sum(q),t=produced(c.name,n);req+=n;prod+=t;q.forEach((v,i)=>sub[i]+=v);body+=`<tr><td>${esc(p.name)}</td>${q.map((v,i)=>`<td><input type="number" min="0" max="999999" step="1" inputmode="numeric" data-id="${p.id}" data-pdv="${i}" value="${v||''}" placeholder="0" aria-label="${esc(p.name)} — ${esc(PDVS[i])}"></td>`).join('')}<td class="total" data-row-request="${p.id}">${n}</td><td class="total" data-row-total="${p.id}">${t}</td></tr>`;});
 body+=`<tr class="subtotal" data-sub="${esc(c.name)}"><td>Subtotal · ${esc(c.name)}</td>${sub.map(n=>`<td>${n}</td>`).join('')}<td>${req}</td><td>${prod}</td></tr>`;
 });
 const t=totals();$('#tables').innerHTML=count?`<table><thead><tr><th>Produto</th>${PDVS.map(n=>`<th>${esc(n)}</th>`).join('')}<th>Solicitado</th><th>A produzir</th></tr></thead><tbody>${body}</tbody><tfoot><tr class="grand"><td>Total geral do plano</td>${t.pdvs.map(n=>`<td>${n}</td>`).join('')}<td>${t.requested}</td><td>${t.production}</td></tr></tfoot></table>`:'<p class="empty">Nenhum produto encontrado.</p>';updateStats();
 $('footer').firstChild.textContent=`${CATALOG.reduce((n,c)=>n+c.products.length,0)} produtos · ${CATALOG.length} categorias · ${PDVS.length} PDVs `;
}
function updateStats(){const t=totals();$('#requested').textContent=t.requested;$('#production').textContent=t.production;$('#destinations').innerHTML=`${t.pdvs.filter(n=>n>0).length} <em>/ ${PDVS.length}</em>`;}
$('#tables').addEventListener('input',e=>{const el=e.target;if(!el.matches('input[data-id]'))return;if(!el.validity.valid){el.setCustomValidity('Informe uma quantidade inteira entre 0 e 999999.');el.reportValidity();el.setCustomValidity('');return;}
 const id=el.dataset.id,i=Number(el.dataset.pdv);plan.values[id]=PDVS.map((_,j)=>Number(plan.values[id]?.[j])||0);plan.values[id][i]=Number(el.value)||0;persistDraft();updateStats();
 const c=CATALOG.find(c=>c.products.some(p=>p.id===id));const n=sum(plan.values[id]);$(`[data-row-request="${id}"]`).textContent=n;$(`[data-row-total="${id}"]`).textContent=produced(c.name,n);
 const sub=PDVS.map(()=>0);let req=0,prod=0;c.products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes($('#search').value.toLocaleLowerCase('pt-BR'))).forEach(p=>{const q=quantities(p);q.forEach((n,i)=>sub[i]+=n);req+=sum(q);prod+=produced(c.name,sum(q));});const row=[...document.querySelectorAll('[data-sub]')].find(r=>r.dataset.sub===c.name);[...sub,req,prod].forEach((n,i)=>row.children[i+1].textContent=n);const t=totals();[...t.pdvs,t.requested,t.production].forEach((n,i)=>$('tfoot tr').children[i+1].textContent=n);
});
$('#date').onchange=e=>{plan.date=e.target.value;persistDraft();};$('#lot').oninput=e=>{plan.lot=e.target.value;persistDraft();};
$('#search').oninput=render;$('#tabs').onclick=e=>{if(e.target.dataset.category){filter=e.target.dataset.category;render();}};
function editor(){ $('#manage').hidden=true;$('#manageNav').classList.remove('active');$('#editor').hidden=false;$('#history').hidden=true;$('#planNav').classList.add('active');$('#historyNav').classList.remove('active');$('h1').textContent='Plano de produção';render(); }
$('#planNav').onclick=editor;
$('#newPlan').onclick=()=>{if(sum(Object.values(plan.values).flat())>0&&!confirm('Abrir um novo plano? Salve o plano atual no histórico antes de continuar.'))return;plan=fresh();filter='Todas';$('#search').value='';persistDraft();editor();};
$('#example').onclick=()=>{if(!confirm('Carregar as quantidades de exemplo da planilha e substituir o rascunho atual?'))return;CATALOG.forEach(c=>c.products.forEach(p=>plan.values[p.id]=PDVS.map((_,i)=>p.example?.[i]||0)));persistDraft();render();};
$('#save').onclick=()=>{if(!plan.date||!plan.lot.trim()){toast('Preencha a data de produção e o lote.');(!plan.date?$('#date'):$('#lot')).focus();return;}if([...document.querySelectorAll('input[type=number]')].some(e=>!e.validity.valid)){toast('Corrija as quantidades inválidas antes de salvar.');return;}const saved={...plan,lot:plan.lot.trim(),updatedAt:new Date().toISOString()};const next=plans.filter(p=>p.id!==plan.id).concat([saved]);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;$('#saveState').textContent='Plano salvo no histórico';toast('Plano salvo no histórico.');}catch{toast('Falha ao salvar. Baixe um backup.');}};
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const csvCell=v=>'"'+String(v).replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
$('#csv').onclick=()=>{const rows=[['Data de produção',plan.date],['Lote',plan.lot],[],['Categoria','Produto',...PDVS,'Solicitado','A produzir']];CATALOG.forEach(c=>c.products.forEach(p=>{const q=quantities(p);rows.push([c.name,p.name,...q,sum(q),produced(c.name,sum(q))]);}));const t=totals();rows.push(['','TOTAL GERAL',...t.pdvs,t.requested,t.production]);download('selectus-producao-'+(plan.date||'plano')+'.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');};
$('#print').onclick=()=>{$('#printClient').innerHTML=PDVS.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('');$('#printDialog').showModal();};
function history(){ $('#manage').hidden=true;$('#manageNav').classList.remove('active');$('#editor').hidden=true;$('#history').hidden=false;$('#planNav').classList.remove('active');$('#historyNav').classList.add('active');$('h1').textContent='Histórico de produção';$('#historyList').innerHTML=plans.length?[...plans].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="history-row"><span><b>${esc(p.date.split('-').reverse().join('/'))} · Lote ${esc(p.lot)}</b><small>${sum(Object.values(p.values).flat())} unidades solicitadas</small></span><button data-open="${esc(p.id)}">Abrir plano</button><button data-delete="${esc(p.id)}">Excluir</button></div>`).join(''):'<p class="empty">Nenhum plano salvo ainda. Preencha a data e o lote e clique em Salvar plano.</p>';}
$('#historyNav').onclick=history;$('#historyList').onclick=e=>{if(e.target.dataset.open){if(!confirm('Abrir este plano e substituir o rascunho atual?'))return;plan=structuredClone(plans.find(p=>p.id===e.target.dataset.open));persistDraft();editor();}if(e.target.dataset.delete&&confirm('Excluir este plano do histórico?')){const next=plans.filter(p=>p.id!==e.target.dataset.delete);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;history();}catch{toast('Não foi possível excluir.');}}};
function backupData(){return {version:2,pdvs:PDVS,catalog:CATALOG,plans,draft:plan};}
$('#backup').onclick=()=>download('selectus-backup-'+today()+'.json',JSON.stringify(backupData(),null,2),'application/json');
function validPlan(p,ids=new Set(CATALOG.flatMap(c=>c.products.map(p=>p.id))),length=PDVS.length){return p&&typeof p.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(p.id)&&typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!isNaN(Date.parse(p.date))&&typeof p.lot==='string'&&p.lot.length<=80&&p.values&&typeof p.values==='object'&&!Array.isArray(p.values)&&Object.entries(p.values).every(([id,v])=>ids.has(id)&&Array.isArray(v)&&v.length<=length&&v.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=999999));}
$('#restore').onchange=async e=>{try{
 const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error();const b=JSON.parse(await file.text());
 const names=b.version===1?DEFAULT_PDVS:b.pdvs,cats=b.version===1?DEFAULT_CATALOG:b.catalog;
 if(![1,2].includes(b.version)||!Array.isArray(names)||names.length<1||names.length>100||names.some(n=>typeof n!=='string'||!n.trim()||n.length>60)||new Set(names).size!==names.length||!Array.isArray(cats)||cats.length!==5)throw Error();
 const ids=new Set();for(const c of cats){if(!DEFAULT_CATALOG.some(d=>d.name===c.name)||!Array.isArray(c.products))throw Error();for(const p of c.products){if(typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>120)throw Error();ids.add(p.id);}}
 if(!Array.isArray(b.plans)||!b.plans.every(p=>validPlan(p,ids,names.length))||(b.draft&&!validPlan(b.draft,ids,names.length)))throw Error();
 if(!confirm('Importar os cadastros e planos? Planos com o mesmo identificador serão atualizados. O rascunho atual será mantido.'))return;
 const newPdvs=[...PDVS];names.forEach(n=>{if(!newPdvs.includes(n))newPdvs.push(n);});const newCatalog=structuredClone(CATALOG);
 cats.forEach(c=>c.products.forEach(p=>{const existing=newCatalog.flatMap(c=>c.products).find(q=>q.id===p.id);if(existing&&existing.name!==p.name)throw Error('ID de produto em conflito.');if(!existing)newCatalog.find(d=>d.name===c.name).products.push({...p,example:[]});}));
 const merged=new Map(plans.map(p=>[p.id,p]));b.plans.forEach(p=>{const imported=structuredClone(p);for(const id in imported.values){const q=imported.values[id];imported.values[id]=newPdvs.map(n=>q[names.indexOf(n)]||0);}merged.set(p.id,imported);});const next=[...merged.values()];
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
 const date=plan.date?plan.date.split('-').reverse().join('/'):'Não informada';
 const indices=mode==='one'?[selected]:mode==='separate'?PDVS.map((_,i)=>i):[null];
 return indices.map(index=>{let total=0,requested=0;let tables='';
 CATALOG.forEach(c=>{let subtotal=0,subreq=0;const rows=c.products.map(p=>{const q=quantities(p),req=index===null?sum(q):q[index],prod=index===null?produced(c.name,req):req;if(!zeros&&req===0)return '';subtotal+=prod;subreq+=req;return `<tr><td>${esc(p.name)}</td>${index===null?`<td>${req}</td>`:''}<td>${prod}</td><td class="report-check">□</td></tr>`;}).join('');if(!rows)return;total+=subtotal;requested+=subreq;
 tables+=`<h3>${esc(c.name)}</h3><table><thead><tr><th>Produto</th>${index===null?'<th>Solicitado</th>':''}<th>${index===null?'A produzir':'Quantidade'}</th><th>Conferência</th></tr></thead><tbody>${rows}<tr class="report-subtotal"><td>Subtotal</td>${index===null?`<td>${subreq}</td>`:''}<td>${subtotal}</td><td></td></tr></tbody></table>`;});
 return `<article class="report-sheet"><div class="report-header"><div><b class="report-brand">Selectus</b><span>ALIMENTOS · COZINHA CENTRAL</span></div><div><h2>${index===null?'Ordem de produção':'Mapa de distribuição'}</h2><p>${index===null?'Consolidado · todos os locais':esc(PDVS[index])}</p></div></div><div class="report-meta"><span>Data de produção <b>${esc(date)}</b></span><span>Lote <b>${esc(plan.lot||'Não informado')}</b></span><span>Destino <b>${index===null?'Todos os locais':esc(PDVS[index])}</b></span></div>${tables||'<p class="empty">Nenhum produto solicitado para este local.</p>'}<div class="report-total"><span>${index===null?'TOTAL A PRODUZIR':'TOTAL A SEPARAR'}</span><b>${total} unidades</b></div>${index===null?`<p class="report-note">Solicitado: ${requested} unidades. Sobremesas arredondadas para múltiplos de 5 na produção consolidada. Quantidades por local permanecem exatas nos mapas de distribuição.</p>`:'<p class="report-note">Quantidades exatas solicitadas para este local, sem arredondamento de produção.</p>'}<div class="signatures"><span>Responsável pela produção: ____________________</span><span>Conferência: ____________________</span></div><div class="report-footer">Selectus Alimentos · Cuidar de você é o nosso propósito.</div></article>`;
 }).join('');
}
$('#confirmPrint').onclick=()=>{
 if(!plan.date||!plan.lot.trim()){toast('Preencha data e lote antes de imprimir.');return;}
 if([...document.querySelectorAll('input[data-id]')].some(e=>!e.validity.valid)){toast('Corrija as quantidades inválidas antes de imprimir.');return;}
 $('#printReport').innerHTML=reportHTML($('#printMode').value,Number($('#printClient').value),$('#printZeros').checked);$('#printDialog').close();document.body.classList.add('printing-report');window.print();
};
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-report'));
render();
