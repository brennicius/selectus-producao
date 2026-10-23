begin;
set local role anon;
select public.production_mutate('save','{"revision":0,"data":{"id":"test-conference-rollback","date":"2026-10-23","lot":"QA-ONLY","values":{"6":[10,6,0,0,0,0]},"actual":{}}}');
select public.production_mutate('actual','{"id":"test-conference-rollback","store":0,"changes":{"6":8},"expected":{"6":null}}');
select public.production_operations('correction','{"id":"test-conference-rollback","store":0,"product":"6","quantity":6,"expected":8,"reason":"Contagem física","responsible":"Teste"}');
select public.production_operations('shipment','{"id":"test-conference-rollback","store":0,"product":"6","quantity":5,"expected":null,"reason":"Expedição","responsible":"Teste"}');
do $$ begin
 if (select count(*) from public.production_audit where plan_id='test-conference-rollback' and kind='correction' and before_qty=8 and after_qty=6 and reason='Contagem física')<>1 then raise exception 'Audit missing'; end if;
 if (select quantity from public.production_shipments where plan_id='test-conference-rollback')<>5 then raise exception 'Shipment missing'; end if;
 begin
 perform public.production_operations('correction','{"id":"test-conference-rollback","store":0,"product":"6","quantity":4,"expected":8,"reason":"Contagem física","responsible":"Teste"}');
 raise exception 'Conflict accepted';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise;end if;end;
 begin
 perform public.production_operations('shipment','{"id":"test-conference-rollback","store":0,"product":"6","quantity":4,"expected":null,"reason":"Expedição","responsible":"Teste"}');
 raise exception 'Shipment conflict accepted';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise;end if;end;
 begin
 delete from public.production_audit where plan_id='test-conference-rollback';raise exception 'Audit delete accepted';
 exception when insufficient_privilege then null;end;
end $$;
select public.production_mutate('actual','{"id":"test-conference-rollback","store":0,"changes":{"6":7},"expected":{"6":6}}');
do $$ begin
 if (select count(*) from public.production_audit where plan_id='test-conference-rollback' and kind='correction')<>2 then raise exception 'Kitchen correction not audited'; end if;
end $$;
do $$ declare src public.production_waste_source; nextsrc jsonb; begin
 select * into src from public.production_waste_source where id=true;
 if src.id is not null then
  nextsrc:=public.production_operations('waste',jsonb_build_object('revision',src.revision,'data',src.data));
  nextsrc:=public.production_operations('waste',jsonb_build_object('revision',(nextsrc->>'revision')::bigint,'data',src.data));
  if jsonb_array_length(nextsrc->'data'->'rows')<>jsonb_array_length(src.data->'rows') then raise exception 'Duplicate import';end if;
 end if;
 begin
  perform public.production_mutate('delete',jsonb_build_object('id','test-conference-rollback','revision',4));
  raise exception 'Shipped lot deleted';
 exception when raise_exception then if SQLERRM not like 'Este plano possui envios%' then raise;end if;end;
end $$;
rollback;
