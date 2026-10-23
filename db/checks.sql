-- Run only as postgres in a transaction. All fixtures are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000000001','selectus-test-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000000002','selectus-test-kitchen@example.invalid',now());
insert into public.production_members(email,role) values
('selectus-test-admin@example.invalid','admin'),('selectus-test-kitchen@example.invalid','kitchen');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"selectus-test-admin@example.invalid"}';
set local role authenticated;
select public.production_mutate('save','{"revision":0,"data":{"id":"test-transaction","date":"2026-10-23","lot":"TEST","values":{"6":[10,6,0,0,0,0]},"actual":{}}}');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","email":"selectus-test-kitchen@example.invalid"}';
set local role authenticated;
select public.production_mutate('actual','{"id":"test-transaction","store":0,"changes":{"6":8},"expected":{"6":null}}');
select public.production_mutate('actual','{"id":"test-transaction","store":1,"changes":{"6":0},"expected":{"6":null}}');
do $test$
begin
 if (select data->'actual'->'6'->0 from public.production_plans where id='test-transaction') <> '8'::jsonb then raise exception 'TEST: store 0 lost'; end if;
 if (select data->'actual'->'6'->1 from public.production_plans where id='test-transaction') <> '0'::jsonb then raise exception 'TEST: zero lost'; end if;
 begin
  perform public.production_mutate('save','{"data":{},"revision":0}');
  raise exception 'TEST: kitchen wrote planned';
 exception when insufficient_privilege then null; end;
 begin
  update public.production_plans set revision=revision+1 where id='test-transaction';
  raise exception 'TEST: direct update allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.production_mutate('actual','{"id":"test-transaction","store":0,"changes":{"6":9},"expected":{"6":null}}');
  raise exception 'TEST: conflict not detected';
 exception when raise_exception then if SQLERRM not like 'CONFLICT:%' then raise; end if; end;
end $test$;
reset role;
set local request.jwt.claims='{}';
set local role anon;
do $test$
begin
 begin
  perform data from public.production_plans;
  raise exception 'TEST: anonymous read allowed';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;
select 'PASS: admin save, kitchen writes, zero, isolation between stores, conflict protection, no anonymous reads' as checks;
rollback;
