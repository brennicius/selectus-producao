/* Acesso público solicitado pelo responsável: os perfis organizam a interface. */
const CLOUD_URL='https://zrljrjyblnclauxjpvdy.supabase.co';
const CLOUD_KEY='sb_publishable_fMp2pAcRUoNG71msVW4KFQ_kS6Mmm3o';
(() => {
  const META='selectus-cloud-draft-v1', LEGACY='selectus-before-cloud-v1';
  let ready=false,configRevision=0,busy=false,dirty=false;
  const bases=new Map();
  const localBefore={version:3,pdvs:structuredClone(PDVS),catalog:structuredClone(CATALOG),plans:structuredClone(plans),draft:structuredClone(plan)};
  try{if(!localStorage.getItem(LEGACY))localStorage.setItem(LEGACY,JSON.stringify(localBefore));}catch{}
  const status=(message,error=false)=>{ $('#cloudStatus').textContent=message;$('#cloudStatus').classList.toggle('error',error); };
  async function api(path,body){
    const response=await fetch(CLOUD_URL+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:CLOUD_KEY,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
    const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Resposta inválida do banco.');}
    if(!response.ok)throw Error(data?.message||'Não foi possível acessar o banco.');return data;
  }
  const mutate=(action,body)=>api('rpc/production_mutate',{action,body});
  async function operation(fn){
    if(busy)return;busy=true;document.body.classList.add('cloud-busy');const panels=['#editor','#manage','#history','header','.cloud-toolbar'].map(selector=>document.querySelector(selector)).filter(Boolean);panels.forEach(panel=>panel.inert=true);
    try{return await fn();}catch(e){status(e.message.includes('CONFLICT')?'Conflito de edição. Baixe um backup do rascunho e atualize os dados antes de tentar novamente.':'Falha ao salvar online. O rascunho foi mantido neste aparelho.',true);toast(e.message);return null;}
    finally{busy=false;panels.forEach(panel=>panel.inert=false);document.body.classList.remove('cloud-busy');}
  }
  function cache(){try{localStorage.setItem(KEY,JSON.stringify(plans));localStorage.setItem(CONFIG,JSON.stringify({pdvs:PDVS,catalog:CATALOG}));}catch{status('Online. Falha ao manter a cópia local.',true);}}
  const originalPersist=persistDraft;
  persistDraft=()=>{originalPersist();dirty=true;try{const base=bases.get(plan.id);localStorage.setItem(META,JSON.stringify({id:plan.id,base:base||null}));}catch{}status('Alterações em rascunho · toque em Salvar para enviar ao banco.');};
  function rememberCurrent(){originalPersist();try{localStorage.setItem(META,JSON.stringify({id:plan.id,base:bases.get(plan.id)||null}));}catch{}}
  function onlineRole(){if(!ready)throw Error('Aguarde a conexão com o banco ou tente Atualizar dados.');}
  function requireAdmin(){onlineRole();if(accessProfile!=='admin')throw Error('Mude para a tela ADM para executar esta ação.');}
  async function allPlans(){let rows=[];for(let offset=0;;offset+=500){const page=await api('production_plans?select=id,data,revision,updated_at&order=updated_at.desc&limit=500&offset='+offset);rows.push(...page);if(page.length<500)return rows;}}
  async function loadCloud(preserveDraft=false){
    const [configs,rows]=await Promise.all([api('production_config?select=data,revision&id=eq.true'),allPlans()]);
    if(!configs.length)throw Error('O cadastro inicial ainda não está disponível.');
    const conf=configs[0];configRevision=conf.revision;PDVS.splice(0,PDVS.length,...conf.data.pdvs);CATALOG.splice(0,CATALOG.length,...conf.data.catalog);
    bases.clear();rows.forEach(r=>bases.set(r.id,structuredClone(r)));plans=rows.map(r=>structuredClone(r.data));
    let restored=false;
    if(preserveDraft){try{const meta=JSON.parse(localStorage.getItem(META)||'null'),draft=JSON.parse(localStorage.getItem(DRAFT)||'null');
      if(meta&&draft&&meta.id===draft.id&&validPlan(draft)){
        const remote=bases.get(draft.id);if(!meta.base||remote){plan=draft;if(meta.base)bases.set(draft.id,meta.base);dirty=!remote||JSON.stringify(draft.values)!==JSON.stringify(remote.data.values)||JSON.stringify(draft.actual||{})!==JSON.stringify(remote.data.actual||{})||draft.lot!==remote.data.lot||draft.date!==remote.data.date;restored=true;}
      }}catch{}}
    if(!restored){plan=plans.find(p=>p.id===plan.id)||plans[0]||fresh();plan=structuredClone(plan);plan.actual??={};dirty=false;}
    cache();rememberCurrent();status(dirty?'Rascunho recuperado. Salve para enviar ao banco.':'Conectado ao Supabase · dados online atualizados');
  }
  function mergeSaved(row,preserveOthers=false,store=null){
    const oldBase=bases.get(plan.id)?.data,local=structuredClone(plan),pending=[];
    if(preserveOthers&&oldBase)CATALOG.forEach(c=>c.products.forEach(p=>PDVS.forEach((_,i)=>{if(i!==store&&(local.actual?.[p.id]?.[i]??null)!==(oldBase.actual?.[p.id]?.[i]??null))pending.push([p.id,i,local.actual?.[p.id]?.[i]??null]);})));
    bases.set(row.id,structuredClone(row));plans=plans.filter(p=>p.id!==row.id).concat([structuredClone(row.data)]);
    plan=structuredClone(row.data);plan.actual??={};pending.forEach(([id,i,v])=>{plan.actual[id]??=PDVS.map(()=>null);plan.actual[id][i]=v;});dirty=pending.length>0;
    cache();rememberCurrent();render();status(pending.length?'Loja salva online. Há alterações em rascunho em outras lojas.':'Plano salvo no Supabase · disponível nos outros aparelhos');
  }
  async function savePlanned(data=plan){requireAdmin();if(!validPlan(data)||!data.lot.trim())throw Error('Preencha uma data, um lote e quantidades válidas.');const row=await mutate('save',{data,revision:bases.get(data.id)?.revision||0});mergeSaved(row);toast('Plano salvo online.');return row;}
  $('#save').onclick=()=>operation(async()=>{if([...document.querySelectorAll('input[type=number]')].some(e=>!e.validity.valid))throw Error('Corrija as quantidades inválidas.');return savePlanned();});
  $('#saveKitchen').onclick=()=>operation(async()=>{
    onlineRole();const invalid=[...document.querySelectorAll('[data-k-input]')].find(e=>!e.validity.valid);if(invalid){invalid.reportValidity();throw Error('Corrija as quantidades inválidas.');}
    const base=bases.get(plan.id);if(!base)throw Error('O ADM precisa salvar este plano online antes do apontamento.');
    const changes={},expected={};CATALOG.forEach(c=>c.products.forEach(p=>{const value=plan.actual?.[p.id]?.[kitchenStore]??null,previous=base.data.actual?.[p.id]?.[kitchenStore]??null;if(value!==previous){changes[p.id]=value;expected[p.id]=previous;}}));
    if(!Object.keys(changes).length){toast('Nenhuma alteração pendente nesta loja.');return;}
    const store=kitchenStore,row=await mutate('actual',{id:plan.id,store,changes,expected});mergeSaved(row,true,store);$('#kitchenSaveState').textContent='Produção desta loja salva no Supabase.';toast('Produção de '+PDVS[store]+' salva online.');
  });
  const originalSetProfile=setProfile;
  setProfile=profile=>{if(!ready){toast('Aguarde a conexão com o banco.');return;}originalSetProfile(profile);$('#cloudMigrate').hidden=profile!=='admin';};
  const originalHistory=history;
  history=()=>{originalHistory();$('#historyList').querySelectorAll('[data-delete]').forEach(b=>b.hidden=accessProfile!=='admin');};
  $('#historyNav').onclick=()=>history();$('#kitchenHistory').onclick=()=>history();
  $('#historyList').onclick=e=>{if(e.target.dataset.open){if(dirty&&!confirm('Há alterações em rascunho. Abrir outro plano? Baixe um backup ou salve antes de continuar.'))return;plan=structuredClone(plans.find(p=>p.id===e.target.dataset.open));plan.actual??={};dirty=false;rememberCurrent();editor();}
    if(e.target.dataset.delete)operation(async()=>{requireAdmin();const id=e.target.dataset.delete;if(!confirm('Excluir este plano do histórico online?'))return;await mutate('delete',{id,revision:bases.get(id)?.revision});plans=plans.filter(p=>p.id!==id);bases.delete(id);if(plan.id===id){plan=fresh();dirty=false;rememberCurrent();}cache();history();toast('Plano removido do histórico online.');});};
  $('#applyImport').onclick=()=>operation(async()=>{requireAdmin();if(!pendingImport)return;if(dirty&&!confirm('Substituir o rascunho pelo plano importado? Salve ou baixe um backup antes de continuar.'))return;const next=pendingImport.plan;await savePlanned(next);workMode='planning';filter='Todas';$('#search').value='';$('#importDialog').close();pendingImport=null;editor();});
  async function saveConfig(pdvs,catalog){requireAdmin();const row=await mutate('config',{revision:configRevision,data:{pdvs,catalog}});configRevision=row.revision;PDVS.splice(0,PDVS.length,...row.data.pdvs);CATALOG.splice(0,CATALOG.length,...row.data.catalog);cache();status('Cadastros salvos no Supabase.');}
  $('#productForm').onsubmit=e=>{e.preventDefault();operation(async()=>{requireAdmin();const name=$('#productName').value.trim(),category=Number($('#productCategory').value);if(!name)return;if(CATALOG.some(c=>c.products.some(p=>normalize(p.name)===normalize(name))))throw Error('Já existe um produto com esse nome.');const next=structuredClone(CATALOG);next[category].products.push({id:uuid(),name:name.toLocaleUpperCase('pt-BR'),example:[]});await saveConfig(PDVS,next);$('#productForm').reset();manage();toast('Produto cadastrado online.');});};
  $('#clientForm').onsubmit=e=>{e.preventDefault();operation(async()=>{requireAdmin();const name=$('#clientName').value.trim();if(!name)return;if(PDVS.some(n=>normalize(n)===normalize(name)))throw Error('Já existe um cliente com esse nome.');await saveConfig([...PDVS,name],CATALOG);$('#clientForm').reset();manage();toast('Cliente cadastrado online.');});};
  // Import is additive: no existing remote plan is overwritten by a device backup.
  async function migrateBackup(backup){
    requireAdmin();const names=backup.version===1?DEFAULT_PDVS:backup.pdvs,cats=backup.version===1?DEFAULT_CATALOG:backup.catalog;
    if(![1,2,3].includes(backup.version)||!Array.isArray(names)||!Array.isArray(cats)||cats.length!==5||!Array.isArray(backup.plans))throw Error('Backup inválido.');
    const draft=backup.draft;if(draft&&draft.lot?.trim()&&validPlan(draft,new Set(cats.flatMap(c=>c.products.map(p=>p.id))),names.length))backup={...backup,plans:backup.plans.filter(p=>p.id!==draft.id).concat([draft])};
    const ids=new Set(cats.flatMap(c=>c.products.map(p=>p.id)));if(!backup.plans.every(p=>validPlan(p,ids,names.length)))throw Error('Um dos planos do backup é inválido.');
    const pdvs=[...PDVS],catalog=structuredClone(CATALOG),idMap=new Map();names.forEach(n=>{if(typeof n!=='string'||n.length>60)throw Error('Cliente inválido.');if(!pdvs.includes(n))pdvs.push(n);});
    cats.forEach(c=>{const target=catalog.find(x=>x.name===c.name);if(!target)throw Error('Categoria inválida.');c.products.forEach(p=>{const sameId=catalog.flatMap(c=>c.products).find(x=>x.id===p.id);if(sameId&&sameId.name!==p.name)throw Error('Identificador de produto em conflito.');const sameName=target.products.find(x=>normalize(x.name)===normalize(p.name));if(sameName)idMap.set(p.id,sameName.id);else{target.products.push({...p,example:[]});idMap.set(p.id,p.id);}});});
    if(!confirm(`Enviar ${backup.plans.length} planos deste backup ao banco? Planos que já existem online serão mantidos. Os dados locais não serão apagados.`))return;
    await saveConfig(pdvs,catalog);let imported=0,skipped=0;const failures=[];
    for(const old of backup.plans){if(bases.has(old.id)){skipped++;continue;}try{const next={...structuredClone(old),values:{},actual:{}};for(const field of ['values','actual'])for(const [id,q] of Object.entries(old[field]||{}))next[field][idMap.get(id)]=pdvs.map(n=>field==='actual'?(q[names.indexOf(n)]??null):(q[names.indexOf(n)]||0));const row=await mutate('save',{data:next,revision:0});bases.set(row.id,row);plans.push(row.data);imported++;}catch(e){failures.push(old.lot+': '+e.message);}}
    cache();status(`Migração: ${imported} enviados · ${skipped} já existentes · ${failures.length} falhas.`,failures.length>0);toast(`${imported} planos enviados ao banco.`);if(failures.length)download('selectus-migracao-falhas.txt',failures.join('\n'),'text/plain');history();
  }
  $('#cloudMigrate').onclick=()=>operation(async()=>{const backup=JSON.parse(localStorage.getItem(LEGACY)||'null');if(!backup)throw Error('Nenhum backup anterior encontrado neste aparelho.');await migrateBackup(backup);});
  $('#downloadLocal').onclick=()=>{const backup=localStorage.getItem(LEGACY);if(backup)download('selectus-antes-do-banco.json',backup,'application/json');};
  $('#restore').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;await operation(async()=>{if(file.size>5000000)throw Error('O backup deve ter até 5 MB.');await migrateBackup(JSON.parse(await file.text()));});};
  $('#cloudRefresh').onclick=()=>operation(async()=>{onlineRole();if(dirty&&!confirm('Atualizar os dados online e descartar o rascunho em tela? Baixe um backup ou salve antes de continuar.'))return;await loadCloud(false);editor();});
  async function enter(){
    $('#chooseAdmin').disabled=true;$('#chooseKitchen').disabled=true;$('#profileLoad').textContent='Carregando os planos online…';
    try{
      await loadCloud(true);ready=true;$('#chooseAdmin').disabled=false;$('#chooseKitchen').disabled=false;$('#profileLoad').textContent='';$('#retryConnection').hidden=true;
      document.querySelectorAll('.kitchen-storage').forEach(e=>e.textContent='Planos e cadastros ficam no Supabase. Toque em Salvar para enviar o rascunho ao banco.');
      $('footer span').textContent='Dados compartilhados no Supabase · salve os apontamentos para sincronizar';
      if(!$('#profileDialog').open)$('#profileDialog').showModal();
    }catch(error){ready=false;status('Não foi possível conectar ao banco. Seus dados locais foram preservados.',true);$('#profileLoad').textContent=error.message;$('#retryConnection').hidden=false;}
  }
  $('#retryConnection').onclick=enter;
  enter();
})();
