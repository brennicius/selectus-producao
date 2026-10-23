// A conferência usa o mesmo fluxo de salvamento online dos planos JSON.
(() => {
  let excel=null,filename='',generation=0;
  function invalidate(){pendingImport=null;$('#applyImport').disabled=true;$('#importReview').textContent='Confira os dados antes de importar.';}
  function mappings(){const mapping={};document.querySelectorAll('[data-excel-column]').forEach(select=>mapping[select.dataset.excelColumn]=select.value);return mapping;}
  function showMappings(){
    $('#excelDetails').hidden=!excel;
    $('#excelMapping').innerHTML=excel?excel.columns.map(c=>`<label>Coluna ${esc(c.title)}<select data-excel-column="${c.col}"><option value="">Selecione o local…</option>${PDVS.map(pdv=>`<option value="${esc(pdv)}" ${pdv===c.pdv?'selected':''}>${esc(pdv)}</option>`).join('')}</select></label>`).join(''):'';
    $('#excelSheet').textContent=excel?'Aba: '+excel.sheet+' · Confira a relação entre as colunas e os locais.':'';
  }
  function jsonMetadata(){try{const data=JSON.parse($('#planJSON').value);$('#importDate').value=data.data_producao||'';$('#importLot').value=data.lote||'';}catch{}}
  $('#importPlan').onclick=()=>{generation++;excel=null;filename='';$('#planFile').value='';$('#planJSON').value='';$('#planJSON').disabled=false;$('#jsonArea').hidden=false;$('#importDate').value='';$('#importLot').value='';$('#reviewImport').disabled=false;showMappings();invalidate();$('#importDialog').showModal();};
  $('#planJSON').oninput=()=>{excel=null;showMappings();jsonMetadata();invalidate();};
  $('#importDate').oninput=invalidate;$('#importLot').oninput=invalidate;$('#excelMapping').onchange=invalidate;
  $('#planFile').onchange=async e=>{
    const file=e.target.files[0],token=++generation;invalidate();if(!file)return;
    $('#reviewImport').disabled=true;$('#importReview').textContent='Lendo o arquivo…';excel=null;showMappings();
    try{
      if(file.size>5000000)throw Error('O arquivo deve ter até 5 MB.');filename=file.name;
      if(/\.xlsx$/i.test(file.name)){
        const parsed=await ExcelProduction.read(await file.arrayBuffer(),PDVS);if(token!==generation)return;
        excel=parsed;$('#importDate').value=parsed.date;$('#importLot').value=parsed.lot;$('#planJSON').value='';$('#planJSON').disabled=true;$('#jsonArea').hidden=true;showMappings();
        $('#importReview').textContent=parsed.date?'Data identificada. Preencha o lote e clique em Conferir arquivo.':'Informe a data de produção e o lote para continuar.';
      }else if(/\.json$/i.test(file.name)){
        const content=await file.text();if(token!==generation)return;$('#planJSON').value=content;$('#planJSON').disabled=false;$('#jsonArea').hidden=false;jsonMetadata();$('#importReview').textContent='JSON carregado. Confira a data e o lote.';
      }else throw Error('Selecione um arquivo .xlsx ou .json.');
    }catch(error){if(token!==generation)return;excel=null;$('#planJSON').value='';$('#planJSON').disabled=false;$('#jsonArea').hidden=false;showMappings();$('#importReview').textContent=error.message;}
    finally{if(token===generation){$('#reviewImport').disabled=false;e.target.value='';}}
  };
  $('#reviewImport').onclick=()=>{
    try{
      let incoming;
      if(excel)incoming=ExcelProduction.incoming(excel,$('#importDate').value,$('#importLot').value,CATALOG,mappings());
      else{try{incoming=JSON.parse($('#planJSON').value);}catch{throw Error('Envie um Excel .xlsx ou cole um JSON válido.');}incoming={...incoming,data_producao:$('#importDate').value,lote:$('#importLot').value.trim()};}
      const result=parseIncomingPlan(JSON.stringify(incoming));result.plan.source={filename:filename||'JSON colado',...(excel?{sheet:excel.sheet}:{}),format:excel?'xlsx':'json'};pendingImport=result;
      const quantities=PDVS.map((_,i)=>Object.values(result.plan.values).reduce((n,q)=>n+(q[i]||0),0));
      const duplicate=plans.some(p=>p.date===result.plan.date&&p.lot===result.plan.lot);
      $('#importReview').innerHTML=`<div class="import-summary"><b>Produção de ${esc(result.plan.date.split('-').reverse().join('/'))}</b><p>Lote: ${esc(result.plan.lot)} · ${Object.keys(result.plan.values).length} produtos · <strong>${result.units} unidades planejadas</strong></p><div class="import-totals">${PDVS.map((pdv,i)=>`<span>${esc(pdv)}<b>${quantities[i]}</b></span>`).join('')}</div><p>Os totais acima usam as quantidades por local. Subtotais, TOTAL e Validade do Excel não são lançados como produtos. A meta da cozinha mantém a regra de arredondamento de sobremesas já configurada no site.</p><p>O Produzido começará em branco para o Josué preencher.</p>${duplicate?'<p class="import-warning">Já existe um plano com esta data e lote. A confirmação criará outro plano; confira para não duplicar a programação.</p>':''}</div>`;
      $('#applyImport').disabled=false;
    }catch(error){pendingImport=null;$('#applyImport').disabled=true;$('#importReview').textContent=error.message;}
  };
})();
