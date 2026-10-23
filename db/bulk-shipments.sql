-- Atomic store dispatch. Existing public access model and append-only audit are preserved.
create function production_private.ship_store(body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.production_plans; item jsonb; result jsonb; count_saved int:=0; store_no int;
begin
 if jsonb_typeof(body->'items') is distinct from 'array' or jsonb_array_length(body->'items') not between 1 and 5000 then raise exception 'Informe as quantidades de envio';end if;
 if (select count(*) from jsonb_array_elements(body->'items'))<>(select count(distinct i->>'product') from jsonb_array_elements(body->'items') i) then raise exception 'Produtos duplicados';end if;
 select * into r from public.production_plans where id=body->>'id' and deleted_at is null for update;
 if r.id is null then raise exception 'Plano não encontrado';end if;
 store_no:=(body->>'store')::int;
 for item in select i from jsonb_array_elements(body->'items') i loop
  if not(item ? 'expected_actual') or coalesce(r.data->'actual'->(item->>'product')->store_no,'null') is distinct from item->'expected_actual' then
   raise exception 'CONFLICT: o produzido mudou; recarregue as quantidades e confira os envios';
  end if;
  result:=production_private.operations('shipment',jsonb_build_object('id',r.id,'store',store_no,'product',item->>'product','quantity',item->'quantity','expected',item->'expected','reason',body->>'reason','responsible',body->>'responsible'));
  if not coalesce((result->>'unchanged')::boolean,false) then count_saved:=count_saved+1;end if;
 end loop;
 return jsonb_build_object('saved',count_saved,'items',jsonb_array_length(body->'items'));
end $$;
revoke all on function production_private.ship_store(jsonb) from public;
grant execute on function production_private.ship_store(jsonb) to anon,authenticated;
create function public.production_ship_store(body jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select production_private.ship_store(body); $$;
revoke all on function public.production_ship_store(jsonb) from public;
grant execute on function public.production_ship_store(jsonb) to anon,authenticated;
