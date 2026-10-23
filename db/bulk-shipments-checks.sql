begin;
set local role anon;
select public.production_mutate('save','{"revision":0,"data":{"id":"test-bulk-ship-rollback","date":"2026-10-23","lot":"TEST-BULK","values":{"6":[8,0,0,0,0,0],"10":[3,0,0,0,0,0]},"actual":{"6":[8],"10":[3]}}}');
select public.production_ship_store('{"id":"test-bulk-ship-rollback","store":0,"responsible":"Teste","reason":"Expedição conferida","items":[{"product":"6","quantity":6,"expected":null,"expected_actual":8},{"product":"10","quantity":0,"expected":null,"expected_actual":3}]}');
do $$ begin
 if (select count(*) from public.production_shipments where plan_id='test-bulk-ship-rollback')<>2 then raise exception 'Missing bulk dispatch';end if;
 if (select count(*) from public.production_audit where plan_id='test-bulk-ship-rollback' and kind='shipment')<>2 then raise exception 'Missing bulk audit';end if;
 begin
  perform public.production_ship_store('{"id":"test-bulk-ship-rollback","store":0,"responsible":"Teste","reason":"Revisão conferida","items":[{"product":"6","quantity":5,"expected":6,"expected_actual":8},{"product":"10","quantity":1,"expected":99,"expected_actual":3}]}');
  raise exception 'Conflict accepted';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise;end if;end;
 if (select quantity from public.production_shipments where plan_id='test-bulk-ship-rollback' and product_id='6')<>6 then raise exception 'Partial save was not rolled back';end if;
 begin
  perform public.production_ship_store('{"id":"test-bulk-ship-rollback","store":0,"responsible":"Teste","reason":"Revisão conferida","items":[{"product":"6","quantity":5,"expected":6,"expected_actual":7}]}');
  raise exception 'Stale production accepted';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise;end if;end;
end $$;
select public.production_ship_store('{"id":"test-bulk-ship-rollback","store":0,"responsible":"Teste","reason":"Expedição conferida","items":[{"product":"6","quantity":6,"expected":6,"expected_actual":8},{"product":"10","quantity":0,"expected":0,"expected_actual":3}]}');
do $$ begin
 if (select count(*) from public.production_audit where plan_id='test-bulk-ship-rollback' and kind='shipment')<>2 then raise exception 'Unchanged resave duplicated audit';end if;
end $$;
rollback;
