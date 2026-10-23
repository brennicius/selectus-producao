-- Selectus Produção. Banco dedicado; nenhuma alteração no Inventário Selectus.
create schema if not exists production_private;
revoke all on schema production_private from public, anon;
grant usage on schema production_private to authenticated;

create table public.production_members (
  email text primary key check (email = lower(btrim(email))),
  role text not null check (role in ('admin','kitchen')),
  created_at timestamptz not null default now()
);
create table public.production_config (
  id boolean primary key default true check (id),
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table public.production_plans (
  id text primary key check (id ~ '^[a-zA-Z0-9-]{1,100}$'),
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index production_plans_recent_idx on public.production_plans(updated_at desc) where deleted_at is null;
alter table public.production_members enable row level security;
alter table public.production_config enable row level security;
alter table public.production_plans enable row level security;
revoke all on public.production_members, public.production_config, public.production_plans from anon, authenticated;
grant select on public.production_members, public.production_config, public.production_plans to authenticated;

create function production_private.access_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.production_members m
  join auth.users u on lower(u.email)=m.email
  where u.id=(select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke all on function production_private.access_role() from public, anon;
grant execute on function production_private.access_role() to authenticated;
create policy own_membership on public.production_members for select to authenticated
  using (email=(select lower(auth.jwt()->>'email')));
create policy team_read_config on public.production_config for select to anon, authenticated
  using (true);
create policy team_read_plans on public.production_plans for select to anon, authenticated
  using (deleted_at is null);

create function public.production_access() returns text language sql stable security invoker set search_path = ''
as $$ select production_private.access_role(); $$;
revoke all on function public.production_access() from public, anon;
grant execute on function public.production_access() to authenticated;

create function production_private.validate_plan(p jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare conf jsonb; item record; v jsonb; slots int;
begin
  select data into conf from public.production_config where id=true;
  slots:=jsonb_array_length(conf->'pdvs');
  if conf is null or jsonb_typeof(p)<>'object' or p->>'id' is null or not (p->>'id' ~ '^[a-zA-Z0-9-]{1,100}$')
    or p->>'lot' is null or length(btrim(p->>'lot')) not between 1 and 80
    or p->>'date' is null or not (p->>'date' ~ '^\d{4}-\d{2}-\d{2}$')
    or (p->>'date')::date::text<>p->>'date' or jsonb_typeof(p->'values') is distinct from 'object'
    or jsonb_typeof(coalesce(p->'actual','{}')) is distinct from 'object' then raise exception 'Plano inválido'; end if;
  for item in select key,value,'planned' as kind from jsonb_each(p->'values')
    union all select key,value,'actual' from jsonb_each(coalesce(p->'actual','{}')) loop
    if not exists(select 1 from jsonb_array_elements(conf->'catalog') c,
      jsonb_array_elements(c->'products') prod where prod->>'id'=item.key)
      or jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)>slots then raise exception 'Produto ou local inválido'; end if;
    for v in select value from jsonb_array_elements(item.value) loop
      if item.kind='actual' and v='null'::jsonb then continue; end if;
      if jsonb_typeof(v)<>'number' or v::text !~ '^\d+$' or (v::text)::numeric>999999 then raise exception 'Quantidade inválida'; end if;
    end loop;
  end loop;
end; $$;
revoke all on function production_private.validate_plan(jsonb) from public, anon, authenticated;

-- As escritas públicas usam funções validadas. Não há escrita direta nas tabelas.
-- Qualquer pessoa com o link pode usar as duas telas e enviar alterações.
create function production_private.mutate(action text, body jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor text; current_row public.production_plans; cfg public.production_config;
  incoming jsonb; existing jsonb; updated jsonb; changes jsonb; expected jsonb; item record;
  value jsonb; old_value jsonb; arr jsonb; product text; store_no int; n int; old_count int;
begin
  -- Acesso livre por solicitação explícita do responsável. Não há autenticação por perfil.
  actor:='admin';
  if action='config' then
    if actor<>'admin' then raise exception 'Apenas ADM' using errcode='42501'; end if;
    select * into cfg from public.production_config where id=true for update;
    if coalesce(cfg.revision,0)<>coalesce((body->>'revision')::bigint,0) then raise exception 'CONFLICT: cadastros alterados em outro aparelho'; end if;
    incoming:=body->'data';
    if jsonb_typeof(incoming->'pdvs') is distinct from 'array' or jsonb_array_length(incoming->'pdvs') not between 1 and 100
      or jsonb_typeof(incoming->'catalog') is distinct from 'array' or jsonb_array_length(incoming->'catalog')<>5 then raise exception 'Cadastro inválido'; end if;
    for value in select v from jsonb_array_elements(incoming->'pdvs') v loop
      if jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 60 then raise exception 'Local inválido'; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(incoming->'pdvs'))<>(select count(distinct lower(btrim(v#>>'{}'))) from jsonb_array_elements(incoming->'pdvs') v)
      then raise exception 'Locais duplicados'; end if;
    for value in select v from jsonb_array_elements(incoming->'catalog') v loop
      if value->>'name' not in ('Cuscuz','Frutas','Saladas gourmet','Sanduíches','Sobremesas')
        or jsonb_typeof(value->'products') is distinct from 'array' then raise exception 'Categoria inválida'; end if;
      for incoming in select v from jsonb_array_elements(value->'products') v loop
        if incoming->>'id' is null or incoming->>'id' !~ '^[a-zA-Z0-9-]{1,100}$'
          or incoming->>'name' is null or length(btrim(incoming->>'name')) not between 1 and 120 then raise exception 'Produto inválido'; end if;
      end loop;
    end loop;
    incoming:=body->'data';
    if (select count(distinct v->>'name') from jsonb_array_elements(incoming->'catalog') v)<>5 then raise exception 'Categorias duplicadas'; end if;
    if (select count(*) from jsonb_array_elements(incoming->'catalog') c,jsonb_array_elements(c->'products') p)
      <> (select count(distinct p->>'id') from jsonb_array_elements(incoming->'catalog') c,jsonb_array_elements(c->'products') p) then raise exception 'Produtos duplicados'; end if;
    if cfg.id is not null then
      old_count:=jsonb_array_length(cfg.data->'pdvs');
      if jsonb_array_length(incoming->'pdvs')<old_count then raise exception 'Não remova locais com histórico'; end if;
      for n in 0..old_count-1 loop
        if cfg.data->'pdvs'->n is distinct from incoming->'pdvs'->n then raise exception 'Não reordene os locais existentes'; end if;
      end loop;
      if exists(select 1 from jsonb_array_elements(cfg.data->'catalog') c,jsonb_array_elements(c->'products') p
        where not exists(select 1 from jsonb_array_elements(incoming->'catalog') nc,jsonb_array_elements(nc->'products') np
          where np->>'id'=p->>'id' and np->>'name'=p->>'name' and nc->>'name'=c->>'name')) then raise exception 'Não remova ou altere produtos com histórico'; end if;
    end if;
    insert into public.production_config(id,data,revision) values(true,incoming,1)
      on conflict(id) do update set data=excluded.data,revision=production_config.revision+1,updated_at=now() returning * into cfg;
    return to_jsonb(cfg);
  end if;
  if action='save' then
    if actor<>'admin' then raise exception 'Apenas ADM pode alterar o planejado' using errcode='42501'; end if;
    incoming:=body->'data';perform production_private.validate_plan(incoming);
    -- Serialize creation of a particular plan as well as updates to it.
    perform pg_advisory_xact_lock(hashtextextended(incoming->>'id',0));
    select * into current_row from public.production_plans where id=incoming->>'id' for update;
    if current_row.id is not null and current_row.deleted_at is not null then raise exception 'Plano excluído'; end if;
    if coalesce(current_row.revision,0)<>coalesce((body->>'revision')::bigint,0) then raise exception 'CONFLICT: plano alterado em outro aparelho; atualize antes de salvar'; end if;
    if current_row.id is not null then incoming:=jsonb_set(incoming,'{actual}',coalesce(current_row.data->'actual','{}')); end if;
    insert into public.production_plans(id,data) values(incoming->>'id',incoming)
      on conflict(id) do update set data=excluded.data,revision=production_plans.revision+1,updated_at=now() returning * into current_row;
    return to_jsonb(current_row);
  end if;
  select * into current_row from public.production_plans where id=body->>'id' and deleted_at is null for update;
  if current_row.id is null then raise exception 'Plano não encontrado'; end if;
  if action='delete' then
    if actor<>'admin' then raise exception 'Apenas ADM' using errcode='42501'; end if;
    if current_row.revision<>(body->>'revision')::bigint then raise exception 'CONFLICT: plano atualizado em outro aparelho'; end if;
    update public.production_plans set deleted_at=now(),revision=revision+1,updated_at=now() where id=current_row.id;
    return jsonb_build_object('deleted',true);
  end if;
  if action<>'actual' then raise exception 'Operação inválida'; end if;
  select * into cfg from public.production_config where id=true;
  store_no:=(body->>'store')::int;
  if store_no is null or store_no<0 or store_no>=jsonb_array_length(cfg.data->'pdvs') then raise exception 'Local inválido'; end if;
  changes:=body->'changes';expected:=body->'expected';
  if jsonb_typeof(changes) is distinct from 'object' or jsonb_typeof(expected) is distinct from 'object' then raise exception 'Apontamento inválido'; end if;
  existing:=coalesce(current_row.data->'actual','{}');updated:=existing;
  for item in select e.key,e.value from jsonb_each(changes) e loop
    if not exists(select 1 from jsonb_array_elements(cfg.data->'catalog') c,jsonb_array_elements(c->'products') p where p->>'id'=item.key) then raise exception 'Produto inválido'; end if;
    value:=item.value;
    if value<>'null'::jsonb and (jsonb_typeof(value)<>'number' or value::text !~ '^\d+$' or (value::text)::numeric>999999) then raise exception 'Quantidade inválida'; end if;
    old_value:=coalesce(existing->item.key->store_no,'null');
    if not (expected ? item.key) or old_value is distinct from expected->item.key then raise exception 'CONFLICT: este produto nesta loja foi alterado em outro aparelho'; end if;
    select jsonb_agg(case when i=store_no then value else coalesce(updated->item.key->i,'null') end order by i)
      into arr from generate_series(0,jsonb_array_length(cfg.data->'pdvs')-1) i;
    updated:=jsonb_set(updated,array[item.key],arr,true);
  end loop;
  update public.production_plans set data=jsonb_set(data,'{actual}',updated),revision=revision+1,updated_at=now()
    where id=current_row.id returning * into current_row;
  return to_jsonb(current_row);
end; $$;
revoke all on function production_private.mutate(text,jsonb) from public, anon;
grant execute on function production_private.mutate(text,jsonb) to authenticated;
create function public.production_mutate(action text,body jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select production_private.mutate(action,body); $$;
revoke all on function public.production_mutate(text,jsonb) from public, anon;
grant execute on function public.production_mutate(text,jsonb) to authenticated;

-- Leitura e RPC públicas, com revisões e validação de quantidades.
grant select on public.production_config,public.production_plans to anon;
grant usage on schema production_private to anon;
grant execute on function production_private.mutate(text,jsonb) to anon;
grant execute on function public.production_mutate(text,jsonb) to anon;
