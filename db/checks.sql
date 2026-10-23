-- Testes de acesso público, todos revertidos ao final.
begin;
set local role anon;
select public.production_mutate('save','{"revision":0,"data":{"id":"test-public-transaction","date":"2026-10-23","lot":"TEST","values":{"6":[10,6,0,0,0,0]},"actual":{}}}');
select public.production_mutate('actual','{"id":"test-public-transaction","store":0,"changes":{"6":8},"expected":{"6":null}}');
select public.production_mutate('actual','{"id":"test-public-transaction","store":1,"changes":{"6":0},"expected":{"6":null}}');
do $test$
begin
 if (select data->'actual'->'6'->0 from public.production_plans where id='test-public-transaction') <> '8'::jsonb then raise exception 'TEST: store 0 lost'; end if;
 if (select data->'actual'->'6'->1 from public.production_plans where id='test-public-transaction') <> '0'::jsonb then raise exception 'TEST: zero lost'; end if;
 begin
  update public.production_plans set revision=revision+1 where id='test-public-transaction';
  raise exception 'TEST: direct update allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.production_mutate('actual','{"id":"test-public-transaction","store":0,"changes":{"6":9},"expected":{"6":null}}');
  raise exception 'TEST: conflict not detected';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise; end if; end;
 begin
  perform public.production_mutate('actual','{"id":"test-public-transaction","store":0,"changes":{"6":-1},"expected":{"6":8}}');
  raise exception 'TEST: negative quantity accepted';
 exception when raise_exception then if SQLERRM <> 'Quantidade inválida' then raise; end if; end;
end $test$;
reset role;
select 'PASS: acesso sem login, apontamentos por loja, zero, conflitos e validação de quantidades' as checks;
rollback;
