/* Shared category rules; catalog additions preserve existing categories. */
const CategoryCatalog=(()=>{
 const key=name=>String(name??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const validName=name=>typeof name==='string'&&name.trim().length>0&&name.trim().length<=80&&key(name)!=='todas';
 function valid(catalog){return Array.isArray(catalog)&&catalog.length>=1&&catalog.length<=100&&catalog.every(c=>c&&validName(c.name)&&Array.isArray(c.products))&&new Set(catalog.map(c=>key(c.name))).size===catalog.length;}
 function add(catalog,name){name=String(name??'').trim();if(!validName(name))throw Error('Informe um nome de categoria de até 80 caracteres, diferente de Todas.');if(!valid(catalog))throw Error('Cadastro de categorias inválido.');if(catalog.some(c=>key(c.name)===key(name)))throw Error('Já existe uma categoria com esse nome.');if(catalog.length>=100)throw Error('Limite de 100 categorias atingido.');return [...structuredClone(catalog),{name,products:[]}];}
 return {key,validName,valid,add};
})();
if(typeof module!=='undefined')module.exports=CategoryCatalog;
