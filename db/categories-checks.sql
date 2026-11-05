begin;
set local role anon;
do $test$
declare before_cfg public.production_config; result jsonb; next_data jsonb; product_id text:='test-custom-category-product';
begin
 select * into before_cfg from public.production_config where id=true;
 next_data:=jsonb_set(before_cfg.data,'{catalog}',(before_cfg.data->'catalog')||'[{"name":"TEST-CATEGORIA-ROLLBACK","products":[]}]'::jsonb);
 result:=public.production_mutate('config',jsonb_build_object('revision',before_cfg.revision,'data',next_data));
 if jsonb_array_length(result->'data'->'catalog')<>jsonb_array_length(before_cfg.data->'catalog')+1 then raise exception 'Category was not added';end if;
 begin
  perform public.production_mutate('config',jsonb_build_object('revision',(result->>'revision')::bigint,'data',jsonb_set(next_data,'{catalog}',(next_data->'catalog')||'[{"name":"test-categoria-rollback","products":[]}]'::jsonb)));
  raise exception 'Duplicate category accepted';
 exception when raise_exception then if SQLERRM<>'Categorias duplicadas' then raise;end if;end;
 begin
  perform public.production_mutate('config',jsonb_build_object('revision',(result->>'revision')::bigint,'data',before_cfg.data));
  raise exception 'Empty category removal accepted';
 exception when raise_exception then if SQLERRM<>'Não remova ou altere categorias existentes' then raise;end if;end;
 next_data:=jsonb_set(next_data,array['catalog',jsonb_array_length(next_data->'catalog')::text],jsonb_build_object('name','TEST-SEGUNDA-CATEGORIA','products',jsonb_build_array(jsonb_build_object('id',product_id,'name','TEST NOVO PRODUTO','example','[]'::jsonb))),true);
 result:=public.production_mutate('config',jsonb_build_object('revision',(result->>'revision')::bigint,'data',next_data));
 perform public.production_mutate('save',jsonb_build_object('revision',0,'data',jsonb_build_object('id','test-category-plan-rollback','date','2026-11-05','lot','QA-CATEGORY-ONLY','values',jsonb_build_object(product_id,jsonb_build_array(2)),'actual','{}'::jsonb)));
 if not exists(select 1 from public.production_plans where id='test-category-plan-rollback') then raise exception 'Custom category product not accepted in plan';end if;
end $test$;
rollback;