const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('cloud saves only the selected store and keeps drafts from other stores',async()=>{
 const elements=new Map(),local=new Map(),session=new Map(),calls=[];let fail=false;
 const row={id:'test-plan',revision:1,data:{id:'test-plan',date:'2026-10-23',lot:'TEST',values:{'6':[10,6,0,0,0,0]},actual:{}}};
 const config={pdvs:['Portugues','Amaro','Izabel','Agnus','CRIS','Amaro2'],catalog:JSON.parse(fs.readFileSync(path.join(root,'catalog.js'),'utf8').replace(/^const CATALOG\s*=\s*/,'').replace(/;\s*$/,''))};
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 session.set('selectus-auth-v1',JSON.stringify({access_token:'test-only',refresh_token:'test-only',expires_at:9999999999,user:{email:'test@example.invalid'}}));
 function el(){return {value:'',textContent:'',innerHTML:'',style:{},firstChild:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return[];},showModal(){},close(){},closest(){return el();},reportValidity(){return true;}};}
 const document={body:el(),querySelector(selector){if(selector.startsWith('[data-product=')||selector==='tfoot tr')return null;if(!elements.has(selector))elements.set(selector,el());return elements.get(selector);},querySelectorAll(){return[];}};
 const ctx={document,console,crypto:require('node:crypto').webcrypto,localStorage:storage(local),sessionStorage:storage(session),Date,Uint8Array,structuredClone,AbortSignal,location:{origin:'https://example.invalid'},window:{addEventListener(){}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},fetch:async(url,options={})=>{
  let data;if(url.includes('production_access'))data='admin';else if(url.includes('production_config'))data=[{revision:1,data:config}];else if(url.includes('production_plans?'))data=[structuredClone(row)];
  else if(url.includes('production_mutate')){const body=JSON.parse(options.body);calls.push(body);if(fail)return {ok:false,text:async()=>JSON.stringify({message:'CONFLICT: edited elsewhere'})};assert.equal(body.action,'actual');const {store,changes,expected}=body.body;for(const [id,value]of Object.entries(changes)){assert.equal(expected[id],row.data.actual[id]?.[store]??null);row.data.actual[id]??=Array(6).fill(null);row.data.actual[id][store]=value;}if(store===0)row.data.actual['6'][1]=2;row.revision++;data=structuredClone(row);}
  else throw Error('Unexpected network request '+url);
  return {ok:true,text:async()=>JSON.stringify(data)};
 }};
 vm.createContext(ctx);let app=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/render\(\);\s*\$\('#profileDialog'\)\.showModal\(\);\s*$/,'');vm.runInContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8')+'\n'+app+'\n'+fs.readFileSync(path.join(root,'cloud.js'),'utf8'),ctx);
 await new Promise(setImmediate);await new Promise(setImmediate);
 vm.runInContext("plan.actual['6']=[8,4,null,null,null,null];kitchenStore=0;",ctx);
 await elements.get('#saveKitchen').onclick();
 assert.deepEqual(calls[0].body.changes,{'6':8});assert.deepEqual(calls[0].body.expected,{'6':null});
 assert.equal(vm.runInContext("plan.actual['6'][1]",ctx),4,'unsaved other-store draft retained');assert.equal(row.data.actual['6'][1],2,'remote other-store value not overwritten');
 vm.runInContext('kitchenStore=1;',ctx);await elements.get('#saveKitchen').onclick();
 assert.deepEqual(calls[1].body.expected,{'6':2});assert.equal(row.data.actual['6'][1],4);assert.equal(row.data.actual['6'][0],8);
 fail=true;vm.runInContext("plan.actual['6'][1]=5;",ctx);await elements.get('#saveKitchen').onclick();assert.equal(vm.runInContext("plan.actual['6'][1]",ctx),5,'conflicted draft preserved');assert.match(elements.get('#cloudStatus').textContent,/Conflito/);
});
