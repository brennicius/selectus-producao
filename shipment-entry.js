const ShipmentEntry=(()=>{
 function seed(plan,shipments,products,store){return Object.fromEntries(products.map(p=>{const old=shipments.find(s=>s.plan_id===plan.id&&s.product_id===p.id&&s.store_no===store)?.quantity??null,actual=plan.actual?.[p.id]?.[store]??null;return [p.id,{value:String(old??actual??''),expected:old,expected_actual:actual}];}));}
 function items(draft){return Object.entries(draft).filter(([,d])=>d.value.trim()!=='').map(([product,d])=>{if(!/^\d+$/.test(d.value)||!Number.isSafeInteger(Number(d.value))||Number(d.value)>999999)throw Error('Use quantidades inteiras de 0 a 999999.');return {product,quantity:Number(d.value),expected:d.expected,expected_actual:d.expected_actual};});}
 return {seed,items};
})();
if(typeof module!=='undefined')module.exports=ShipmentEntry;
