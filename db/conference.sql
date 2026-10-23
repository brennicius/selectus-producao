-- Additive migration. Public access intentionally retained; writes only through validated RPCs.
create table public.production_audit (
 id bigint generated always as identity primary key, created_at timestamptz not null default now(),
 kind text not null check(kind in ('correction','shipment')), plan_id text not null,
 lot text not null, production_date text not null, product_id text not null, product_name text not null,
 store_no int not null, store_name text not null, before_qty int, after_qty int,
 reason text not null, responsible text not null
);
create index production_audit_recent_idx on public.production_audit(created_at desc,id desc);
create table public.production_shipments (
 plan_id text not null references public.production_plans(id), product_id text not null, store_no int not null,
 quantity int not null check(quantity between 0 and 999999), updated_at timestamptz not null default now(),
 primary key(plan_id,product_id,store_no)
);
create table public.production_waste_source (
 id boolean primary key default true check(id), revision bigint not null default 1,
 data jsonb not null, updated_at timestamptz not null default now()
);
alter table public.production_audit enable row level security;
alter table public.production_shipments enable row level security;
alter table public.production_waste_source enable row level security;
revoke all on public.production_audit,public.production_shipments,public.production_waste_source from anon,authenticated;
grant select on public.production_audit,public.production_shipments,public.production_waste_source to anon,authenticated;
create policy public_read on public.production_audit for select to anon,authenticated using(true);
create policy public_read on public.production_shipments for select to anon,authenticated using(true);
create policy public_read on public.production_waste_source for select to anon,authenticated using(true);

create function production_private.audit_actual() returns trigger language plpgsql security definer set search_path='' as $$
declare cfg jsonb; p record; i int; b jsonb; a jsonb;
begin
 if old.data->'actual' is not distinct from new.data->'actual' then return new; end if;
 select data into cfg from public.production_config where id=true;
 for p in select x->>'id' id,x->>'name' name from jsonb_array_elements(cfg->'catalog') c,jsonb_array_elements(c->'products') x loop
  for i in 0..jsonb_array_length(cfg->'pdvs')-1 loop
   b:=coalesce(old.data->'actual'->p.id->i,'null');a:=coalesce(new.data->'actual'->p.id->i,'null');
   if b<>'null'::jsonb and a is distinct from b then
    insert into public.production_audit(kind,plan_id,lot,production_date,product_id,product_name,store_no,store_name,before_qty,after_qty,reason,responsible)
    values('correction',new.id,old.data->>'lot',old.data->>'date',p.id,p.name,i,cfg->'pdvs'->>i,(b#>>'{}')::int,(a#>>'{}')::int,
     coalesce(nullif(current_setting('selectus.reason',true),''),'Revisão do apontamento pela tela de produção'),
     coalesce(nullif(current_setting('selectus.responsible',true),''),'Josué / Cozinha (perfil informado)'));
   end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function production_private.audit_actual() from public,anon,authenticated;
create trigger audit_production_actual after update of data on public.production_plans for each row execute function production_private.audit_actual();

create function production_private.operations(action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.production_plans; cfg jsonb; src public.production_waste_source; product text; label text; s int; q jsonb; previous int; reason text; responsible text; result jsonb; event jsonb;
begin
 -- Acesso livre autorizado pelo proprietário. Nomes são autodeclarados, não identidades autenticadas.
 if action='waste' then
  perform pg_advisory_xact_lock(82372391);
  select * into src from public.production_waste_source where id=true for update;
  if coalesce(src.revision,0) is distinct from (body->>'revision')::bigint then raise exception 'CONFLICT: descartes atualizados em outro aparelho'; end if;
  result:=body->'data';
  if jsonb_typeof(result) is distinct from 'object' or jsonb_typeof(result->'rows') is distinct from 'array' or jsonb_array_length(result->'rows')>10000 or octet_length(result::text)>4000000 or jsonb_typeof(result->'mapping') is distinct from 'object' or jsonb_typeof(result->'filename') is distinct from 'string' or length(result->>'filename') not between 1 and 200 then raise exception 'Arquivo de descartes inválido'; end if;
  for event in select e from jsonb_array_elements(result->'rows') e loop
   if jsonb_typeof(event->'quantity') is distinct from 'number' or (event->>'quantity') !~ '^\d+$' or (event->>'quantity')::numeric>999999
    or jsonb_typeof(event->'product') is distinct from 'string' or jsonb_typeof(event->'store') is distinct from 'string' or jsonb_typeof(event->'lot') is distinct from 'string' or length(event->>'product') not between 1 and 150 or length(event->>'store') not between 1 and 80
    or length(coalesce(event->>'lot',''))>80 or event->>'date' is null or (event->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Registro de descarte inválido'; end if;
   perform (event->>'date')::date;
  end loop;
  insert into public.production_waste_source(id,data) values(true,result) on conflict(id) do update set data=excluded.data,revision=production_waste_source.revision+1,updated_at=now() returning * into src;
  return to_jsonb(src);
 end if;
 if action not in ('correction','shipment') then raise exception 'Operação inválida'; end if;
 reason:=btrim(body->>'reason');responsible:=btrim(body->>'responsible');
 if reason is null or length(reason) not between 3 and 500 or responsible is null or length(responsible) not between 2 and 100 then raise exception 'Informe o motivo e o responsável'; end if;
 select * into r from public.production_plans where id=body->>'id' and deleted_at is null for update;
 if r.id is null then raise exception 'Plano não encontrado'; end if;
 select data into cfg from public.production_config where id=true;
 product:=body->>'product';s:=(body->>'store')::int;q:=body->'quantity';
 select p->>'name' into label from jsonb_array_elements(cfg->'catalog') c,jsonb_array_elements(c->'products') p where p->>'id'=product;
 if label is null or s is null or s<0 or s>=jsonb_array_length(cfg->'pdvs') then raise exception 'Produto ou local inválido'; end if;
 if q is null or jsonb_typeof(q) is distinct from 'number' or q::text !~ '^\d+$' or q::numeric>999999 then raise exception 'Quantidade inválida'; end if;
 if action='correction' then
  if coalesce(r.data->'actual'->product->s,'null')='null'::jsonb then raise exception 'Registre primeiro o produzido na tela da cozinha'; end if;
  perform set_config('selectus.reason',reason,true);perform set_config('selectus.responsible',responsible,true);
  result:=production_private.mutate('actual',jsonb_build_object('id',r.id,'store',s,'changes',jsonb_build_object(product,q),'expected',jsonb_build_object(product,body->'expected')));
  perform set_config('selectus.reason','',true);perform set_config('selectus.responsible','',true);
  return result;
 end if;
 select quantity into previous from public.production_shipments where plan_id=r.id and product_id=product and store_no=s;
 if not(body ? 'expected') or to_jsonb(previous) is distinct from nullif(body->'expected','null'::jsonb) then raise exception 'CONFLICT: envio alterado em outro aparelho'; end if;
 if previous is not distinct from q::text::int then return jsonb_build_object('unchanged',true); end if;
 insert into public.production_shipments(plan_id,product_id,store_no,quantity) values(r.id,product,s,q::text::int)
 on conflict(plan_id,product_id,store_no) do update set quantity=excluded.quantity,updated_at=now();
 insert into public.production_audit(kind,plan_id,lot,production_date,product_id,product_name,store_no,store_name,before_qty,after_qty,reason,responsible)
 values('shipment',r.id,r.data->>'lot',r.data->>'date',product,label,s,cfg->'pdvs'->>s,previous,q::text::int,reason,responsible);
 return jsonb_build_object('saved',true);
end $$;
revoke all on function production_private.operations(text,jsonb) from public;
grant execute on function production_private.operations(text,jsonb) to anon,authenticated;
create function public.production_operations(action text,body jsonb) returns jsonb language sql security invoker set search_path='' as $$ select production_private.operations(action,body); $$;
revoke all on function public.production_operations(text,jsonb) from public;
grant execute on function public.production_operations(text,jsonb) to anon,authenticated;

-- Keep a shipment attached to its original lot; changing the plan cannot silently move dispatches.
create function production_private.protect_shipped_lot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.deleted_at is distinct from old.deleted_at or new.data->>'lot' is distinct from old.data->>'lot' or new.data->>'date' is distinct from old.data->>'date')
 and exists(select 1 from public.production_shipments where plan_id=old.id) then
  raise exception 'Este plano possui envios registrados. Preserve a data e o lote e corrija as quantidades pela Conferência.';
 end if;
 return new;
end $$;
revoke all on function production_private.protect_shipped_lot() from public,anon,authenticated;
create trigger protect_shipped_lot before update on public.production_plans for each row execute function production_private.protect_shipped_lot();
