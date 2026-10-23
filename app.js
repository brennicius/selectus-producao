const PDVS=['Portugues','Amaro','Izabel','Agnus','CRIS','Amaro2'];
const $=s=>document.querySelector(s), KEY='selectus-production-v1', DRAFT='selectus-draft-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const fresh=()=>({id:crypto.randomUUID(),date:today(),lot:'',values:{}});
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
 body+=`<tr class="category"><th colspan="9">${esc(c.name.toUpperCase())} <span> · ${products.length} produtos</span></th></tr>`;
 products.forEach(p=>{const q=quantities(p),n=sum(q),t=produced(c.name,n);req+=n;prod+=t;q.forEach((v,i)=>sub[i]+=v);body+=`<tr><td>${esc(p.name)}</td>${q.map((v,i)=>`<td><input type="number" min="0" max="999999" step="1" inputmode="numeric" data-id="${p.id}" data-pdv="${i}" value="${v||''}" placeholder="0" aria-label="${esc(p.name)} — ${PDVS[i]}"></td>`).join('')}<td class="total" data-row-request="${p.id}">${n}</td><td class="total" data-row-total="${p.id}">${t}</td></tr>`;});
 body+=`<tr class="subtotal" data-sub="${esc(c.name)}"><td>Subtotal · ${esc(c.name)}</td>${sub.map(n=>`<td>${n}</td>`).join('')}<td>${req}</td><td>${prod}</td></tr>`;
 });
 const t=totals();$('#tables').innerHTML=count?`<table><thead><tr><th>Produto</th>${PDVS.map(n=>`<th>${n}</th>`).join('')}<th>Solicitado</th><th>A produzir</th></tr></thead><tbody>${body}</tbody><tfoot><tr class="grand"><td>Total geral do plano</td>${t.pdvs.map(n=>`<td>${n}</td>`).join('')}<td>${t.requested}</td><td>${t.production}</td></tr></tfoot></table>`:'<p class="empty">Nenhum produto encontrado.</p>';updateStats();
}
function updateStats(){const t=totals();$('#requested').textContent=t.requested;$('#production').textContent=t.production;$('#destinations').innerHTML=`${t.pdvs.filter(n=>n>0).length} <em>/ 6</em>`;}
$('#tables').addEventListener('input',e=>{const el=e.target;if(!el.matches('input[data-id]'))return;if(!el.validity.valid){el.setCustomValidity('Informe uma quantidade inteira entre 0 e 999999.');el.reportValidity();el.setCustomValidity('');return;}
 const id=el.dataset.id,i=Number(el.dataset.pdv);plan.values[id]??=PDVS.map(()=>0);plan.values[id][i]=Number(el.value)||0;persistDraft();updateStats();
 const c=CATALOG.find(c=>c.products.some(p=>p.id===id));const n=sum(plan.values[id]);$(`[data-row-request="${id}"]`).textContent=n;$(`[data-row-total="${id}"]`).textContent=produced(c.name,n);
 const sub=PDVS.map(()=>0);let req=0,prod=0;c.products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes($('#search').value.toLocaleLowerCase('pt-BR'))).forEach(p=>{const q=quantities(p);q.forEach((n,i)=>sub[i]+=n);req+=sum(q);prod+=produced(c.name,sum(q));});const row=[...document.querySelectorAll('[data-sub]')].find(r=>r.dataset.sub===c.name);[...sub,req,prod].forEach((n,i)=>row.children[i+1].textContent=n);const t=totals();[...t.pdvs,t.requested,t.production].forEach((n,i)=>$('tfoot tr').children[i+1].textContent=n);
});
$('#date').onchange=e=>{plan.date=e.target.value;persistDraft();};$('#lot').oninput=e=>{plan.lot=e.target.value;persistDraft();};
$('#search').oninput=render;$('#tabs').onclick=e=>{if(e.target.dataset.category){filter=e.target.dataset.category;render();}};
function editor(){ $('#editor').hidden=false;$('#history').hidden=true;$('#planNav').classList.add('active');$('#historyNav').classList.remove('active');$('h1').textContent='Plano de produção';render(); }
$('#planNav').onclick=editor;
$('#newPlan').onclick=()=>{if(sum(Object.values(plan.values).flat())>0&&!confirm('Abrir um novo plano? Salve o plano atual no histórico antes de continuar.'))return;plan=fresh();filter='Todas';$('#search').value='';persistDraft();editor();};
$('#example').onclick=()=>{if(!confirm('Carregar as quantidades de exemplo da planilha e substituir o rascunho atual?'))return;CATALOG.forEach(c=>c.products.forEach(p=>plan.values[p.id]=[...p.example]));persistDraft();render();};
$('#save').onclick=()=>{if(!plan.date||!plan.lot.trim()){toast('Preencha a data de produção e o lote.');(!plan.date?$('#date'):$('#lot')).focus();return;}if([...document.querySelectorAll('input[type=number]')].some(e=>!e.validity.valid)){toast('Corrija as quantidades inválidas antes de salvar.');return;}const saved={...plan,lot:plan.lot.trim(),updatedAt:new Date().toISOString()};const next=plans.filter(p=>p.id!==plan.id).concat([saved]);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;$('#saveState').textContent='Plano salvo no histórico';toast('Plano salvo no histórico.');}catch{toast('Falha ao salvar. Baixe um backup.');}};
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const csvCell=v=>'"'+String(v).replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
$('#csv').onclick=()=>{const rows=[['Data de produção',plan.date],['Lote',plan.lot],[],['Categoria','Produto',...PDVS,'Solicitado','A produzir']];CATALOG.forEach(c=>c.products.forEach(p=>{const q=quantities(p);rows.push([c.name,p.name,...q,sum(q),produced(c.name,sum(q))]);}));const t=totals();rows.push(['','TOTAL GERAL',...t.pdvs,t.requested,t.production]);download('selectus-producao-'+(plan.date||'plano')+'.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');};
$('#print').onclick=()=>{filter='Todas';$('#search').value='';render();window.print();};
function history(){ $('#editor').hidden=true;$('#history').hidden=false;$('#planNav').classList.remove('active');$('#historyNav').classList.add('active');$('h1').textContent='Histórico de produção';$('#historyList').innerHTML=plans.length?[...plans].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="history-row"><span><b>${esc(p.date.split('-').reverse().join('/'))} · Lote ${esc(p.lot)}</b><small>${sum(Object.values(p.values).flat())} unidades solicitadas</small></span><button data-open="${esc(p.id)}">Abrir plano</button><button data-delete="${esc(p.id)}">Excluir</button></div>`).join(''):'<p class="empty">Nenhum plano salvo ainda. Preencha a data e o lote e clique em Salvar plano.</p>';}
$('#historyNav').onclick=history;$('#historyList').onclick=e=>{if(e.target.dataset.open){if(!confirm('Abrir este plano e substituir o rascunho atual?'))return;plan=structuredClone(plans.find(p=>p.id===e.target.dataset.open));persistDraft();editor();}if(e.target.dataset.delete&&confirm('Excluir este plano do histórico?')){const next=plans.filter(p=>p.id!==e.target.dataset.delete);try{localStorage.setItem(KEY,JSON.stringify(next));plans=next;history();}catch{toast('Não foi possível excluir.');}}};
$('#backup').onclick=()=>download('selectus-backup-'+today()+'.json',JSON.stringify({version:1,plans,draft:plan},null,2),'application/json');
function validPlan(p){const ids=new Set(CATALOG.flatMap(c=>c.products.map(p=>p.id)));return p&&typeof p.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(p.id)&&typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!isNaN(Date.parse(p.date))&&typeof p.lot==='string'&&p.lot.length<=80&&p.values&&typeof p.values==='object'&&!Array.isArray(p.values)&&Object.entries(p.values).every(([id,v])=>ids.has(id)&&Array.isArray(v)&&v.length===6&&v.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=999999));}
$('#restore').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error();const b=JSON.parse(await file.text());if(b.version!==1||!Array.isArray(b.plans)||!b.plans.every(validPlan)||(b.draft&&!validPlan(b.draft)))throw Error();if(!confirm('Importar os planos do backup? Planos com o mesmo identificador serão atualizados.'))return;const merged=new Map(plans.map(p=>[p.id,p]));b.plans.forEach(p=>merged.set(p.id,p));const next=[...merged.values()];localStorage.setItem(KEY,JSON.stringify(next));plans=next;history();toast('Histórico restaurado.');}catch{toast('Backup inválido ou armazenamento indisponível.');}finally{e.target.value='';}};
render();
