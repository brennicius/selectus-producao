/* Leitura local de XLSX (ZIP/XML). Não envia o arquivo a serviços externos. */
const ExcelProduction = (() => {
  const text=bytes=>new TextDecoder().decode(bytes);
  async function unzip(buffer){
    const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0)throw Error('O arquivo não é um Excel .xlsx válido.');
    const entries=view.getUint16(end+10,true),directory=view.getUint32(end+16,true);if(entries>2000)throw Error('Arquivo Excel muito complexo.');
    const files=new Map();let cursor=directory,total=0;
    for(let i=0;i<entries;i++){
      if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw Error('Arquivo Excel danificado.');
      const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),size=view.getUint32(cursor+20,true),expanded=view.getUint32(cursor+24,true),nameSize=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),offset=view.getUint32(cursor+42,true);
      const name=text(bytes.subarray(cursor+46,cursor+46+nameSize));cursor+=46+nameSize+extra+comment;
      if(flags&1)throw Error('Remova a senha de proteção do arquivo antes de importar.');
      total+=expanded;if(total>30000000||expanded>15000000)throw Error('O Excel excede o tamanho permitido após a leitura.');
      if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw Error('Estrutura ZIP inválida.');
      const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+size>bytes.length)throw Error('Arquivo incompleto.');
      if(!name.endsWith('.xml')&&!name.endsWith('.rels'))continue;
      const compressed=bytes.subarray(start,start+size);let output;
      if(method===0)output=compressed;
      else if(method===8){
        try{const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader(),parts=[];let count=0;for(;;){const part=await reader.read();if(part.done)break;count+=part.value.length;if(count>expanded||count>15000000){await reader.cancel();throw Error('Tamanho inválido');}parts.push(part.value);}output=new Uint8Array(count);let pos=0;for(const part of parts){output.set(part,pos);pos+=part.length;}}
        catch{throw Error('Não foi possível descompactar o Excel. Use um navegador atualizado ou salve novamente como .xlsx.');}
      }else throw Error('Compressão do Excel não suportada. Salve novamente como .xlsx.');
      if(output.length!==expanded)throw Error('Arquivo Excel com tamanho inconsistente.');files.set(name,text(output));
    }
    return files;
  }
  function xml(source){if(!source)throw Error('O Excel não contém uma estrutura de planilha válida.');if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('XML não permitido.');const document=new DOMParser().parseFromString(source,'application/xml');if(document.getElementsByTagName('parsererror').length)throw Error('XML do Excel inválido.');return document;}
  const elements=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
  const clean=s=>String(s??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  function index(reference){let n=0;for(const c of reference.replace(/\d/g,''))n=n*26+c.charCodeAt(0)-64;return n-1;}
  function sheetGrid(source,strings){const grid=[];for(const row of elements(xml(source),'row')){const n=Number(row.getAttribute('r'))-1;if(n<0||n>10000)throw Error('Planilha com linhas demais.');grid[n]=[];for(const c of elements(row,'c')){const col=index(c.getAttribute('r')||'');if(col<0||col>300)throw Error('Planilha com colunas demais.');const type=c.getAttribute('t'),v=elements(c,'v')[0]?.textContent;let value;if(type==='s')value=strings[Number(v)]??'';else if(type==='inlineStr')value=elements(c,'t').map(t=>t.textContent).join('');else if(type==='b'||type==='e')value={invalid:true};else if(type==='str')value=v||'';else value=v===undefined?'':Number(v);grid[n][col]={value,formula:elements(c,'f').length>0};}}return grid;}
  const val=cell=>cell?.value??'';
  function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
  function metadata(grid,headerRow,date1904){
    const dates=new Set();let lot='';
    for(const row of grid.slice(0,headerRow)){if(!row)continue;for(let i=0;i<row.length;i++){
      const raw=String(val(row[i])),s=clean(raw);
      const match=s.match(/produca[oã][^\d]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i);if(match){const iso=match[3]+'-'+match[2]+'-'+match[1];if(validDate(iso))dates.add(iso);}
      if(/^data(?: de)? producao\s*:?$/.test(s)){const next=val(row[i+1]);if(typeof next==='number'){const d=new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+Math.floor(next)*86400000);dates.add(d.toISOString().slice(0,10));}else{const m=String(next).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)dates.add(m[3]+'-'+m[2]+'-'+m[1]);}}
      if(/^lote\s*:?$/.test(s))lot=String(val(row[i+1])).trim();
    }}
    return {date:dates.size===1?[...dates][0]:'',lot};
  }
  function defaultClient(header,pdvs){
    const aliases={hp:['portugues','hospital portugues'],sa:['amaro','santo amaro'],iz:['izabel','santa izabel'],amaro2:['amaro2','amaro 2','santo amaro 2']},name=clean(header);
    const exact=pdvs.filter(n=>clean(n)===name);if(exact.length===1)return exact[0];
    const options=aliases[name]||[];const matches=pdvs.filter(n=>options.includes(clean(n)));return matches.length===1?matches[0]:'';
  }
  function identify(grid,pdvs,date1904=false){
    const headerRow=grid.findIndex(row=>row&&clean(val(row[0]))==='produto');if(headerRow<0)return null;
    const columns=[];for(let col=1;col<grid[headerRow].length;col++){const title=String(val(grid[headerRow][col])).trim();if(!title||/^(total|validade|observac|a produzir)/i.test(clean(title)))continue;columns.push({col,title,pdv:defaultClient(title,pdvs)});}
    if(!columns.length)throw Error('A aba não tem colunas de locais reconhecíveis.');
    return {grid,headerRow,columns,...metadata(grid,headerRow,date1904)};
  }
  async function readWorkbook(buffer,onlySheets=null){
    const files=await unzip(buffer),workbook=xml(files.get('xl/workbook.xml')),rels=xml(files.get('xl/_rels/workbook.xml.rels'));
    const shared=files.has('xl/sharedStrings.xml')?elements(xml(files.get('xl/sharedStrings.xml')),'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')):[];
    const relationships=new Map(elements(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));const found=[];
    const date1904=['1','true'].includes(elements(workbook,'workbookPr')[0]?.getAttribute('date1904'));
    for(const sheet of elements(workbook,'sheet')){
      if(onlySheets&&!onlySheets.includes(sheet.getAttribute('name')))continue;
      const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id'),target=relationships.get(id);if(!target)continue;
      const parts=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),path=[];for(const part of parts){if(part==='..')path.pop();else if(part&&part!=='.')path.push(part);}
      const source=files.get(path.join('/'));if(!source)continue;found.push({grid:sheetGrid(source,shared),date1904,sheet:sheet.getAttribute('name')});
    }
    return found;
  }
  async function read(buffer,pdvs){
    const found=(await readWorkbook(buffer)).map(s=>{const r=identify(s.grid,pdvs,s.date1904);return r?{...r,sheet:s.sheet}:null;}).filter(Boolean);
    if(found.length!==1)throw Error(found.length?'Há mais de uma aba de produção. Envie um arquivo com apenas o plano que deseja importar.':'Não encontrei uma aba com o cabeçalho Produto e as colunas dos locais.');return found[0];
  }
  function incoming(parsed,date,lot,catalog,mapping){
    if(!validDate(date))throw Error('Informe uma data de produção válida.');if(!lot.trim()||lot.length>80)throw Error('Informe o lote da produção (até 80 caracteres).');
    const columns=parsed.columns.map(c=>({...c,pdv:mapping[c.col]}));if(columns.some(c=>!c.pdv))throw Error('Escolha o local correspondente a cada coluna do Excel.');if(new Set(columns.map(c=>c.pdv)).size!==columns.length)throw Error('Duas colunas foram associadas ao mesmo local. Confira os locais.');
    const products=catalog.flatMap(c=>c.products),items=[];let productCount=0;
    for(let n=parsed.headerRow+1;n<parsed.grid.length;n++){
      const row=parsed.grid[n];if(!row)continue;const label=String(val(row[0])).trim();if(!label)continue;
      if(/^total\b/i.test(clean(label)))continue;
      const product=products.find(p=>clean(p.name)===clean(label));
      if(!product){if(columns.some(c=>val(row[c.col])!==''))throw Error(`Linha ${n+1}: produto não cadastrado: ${label}`);continue;}
      productCount++;
      for(const c of columns){const cell=row[c.col],raw=val(cell);if(cell?.formula)throw Error(`Linha ${n+1}, ${c.title}: informe a quantidade como número, sem fórmula.`);const number=raw===''?0:raw;if(typeof number!=='number'||!Number.isSafeInteger(number)||number<0||number>999999)throw Error(`Linha ${n+1}, ${c.title}: quantidade inválida. Use um número inteiro entre 0 e 999999.`);items.push({produto:product.name,pdv:c.pdv,planejado:number});}
    }
    if(!productCount)throw Error('Nenhum produto cadastrado foi encontrado no arquivo.');return {versao:1,data_producao:date,lote:lot.trim(),itens:items};
  }
  return {read,readWorkbook,incoming,identify,defaultClient,unzip};
})();
