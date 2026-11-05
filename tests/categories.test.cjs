const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('creates custom category and product online and rejects duplicate or reserved names',async()=>{
 const APP_SOURCE=['category-utils.js','catalog.js','app.js','cloud.js'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
 const CATALOG_SOURCE=fs.readFileSync(path.join(root,'catalog.js'),'utf8');

 const elements=new Map(),storage=new Map(),calls=[];
 const clone=v=>JSON.parse(JSON.stringify(v));
 let catalog=JSON.parse(CATALOG_SOURCE.slice(CATALOG_SOURCE.indexOf('=')+1).trim().replace(/;$/,''));
 let revision=1;
 function el(){return {value:'',textContent:'',innerHTML:'',style:{},firstChild:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return[];},showModal(){},close(){},closest(){return el();},reportValidity(){return true;},reset(){}};}
 const document={body:el(),querySelector(s){if(s.startsWith('[data-product=')||s==='tfoot tr')return null;if(!elements.has(s))elements.set(s,el());return elements.get(s);},querySelectorAll(){return[];}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const fetch=async(url,options)=>{let data;if(url.includes('production_config'))data=[{revision,data:{pdvs:['Portugues','Amaro','Izabel','Agnus','CRIS','Amaro2'],catalog}}];else if(url.includes('production_plans?'))data=[];else{const b=JSON.parse(options.body);assert.equal(b.action,'config');calls.push(b);assert.equal(b.body.revision,revision);catalog=clone(b.body.data.catalog);data={revision:++revision,data:b.body.data};}return {ok:true,text:async()=>JSON.stringify(data)};};
 const run=new Function('document','window','crypto','localStorage','sessionStorage','structuredClone','AbortSignal','fetch','confirm','setTimeout','clearTimeout',APP_SOURCE+';return {setProfile:p=>setProfile(p),getCatalog:()=>CATALOG,manage:()=>manage()};');
 const api=run(document,{addEventListener(){},setTimeout:()=>0},{randomUUID:()=> 'test-category-uuid'},localStorage,localStorage,clone,{timeout:()=>undefined},fetch,()=>true,()=>0,()=>{});
 for(let i=0;i<20;i++)await Promise.resolve();
 api.setProfile('admin');
 document.querySelector('#categoryName').value='Açaí';
 await document.querySelector('#categoryForm').onsubmit({preventDefault(){}});
 for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(catalog.length,6);assert.equal(catalog[5].name,'Açaí');
 assert.equal(document.querySelector('#productCategory').value,'5');
 assert.ok(document.querySelector('#productList').innerHTML.includes('Açaí'));
 document.querySelector('#productName').value='Tigela de açaí';document.querySelector('#productCategory').value='5';
 await document.querySelector('#productForm').onsubmit({preventDefault(){}});
 for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(catalog[5].products[0].name,'TIGELA DE AÇAÍ');
 const count=calls.length;
 document.querySelector('#categoryName').value='acai';
 await document.querySelector('#categoryForm').onsubmit({preventDefault(){}});
 for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(calls.length,count);assert.ok(document.querySelector('#toast').textContent.includes('Já existe'));
 document.querySelector('#categoryName').value='Todas';
 await document.querySelector('#categoryForm').onsubmit({preventDefault(){}});
 for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(calls.length,count);

});
