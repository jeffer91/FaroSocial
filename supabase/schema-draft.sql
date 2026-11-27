-- Borrador SaaS 0.5 para un proyecto nuevo y exclusivo. No aplicado.
begin;
create table public.faro_plans (
 code text primary key check(code in ('free','pro','business')),
 name text not null,
 max_brands integer not null check(max_brands between 1 and 100),
 max_connections integer not null check(max_connections>0),
 max_monthly_posts integer not null check(max_monthly_posts>0)
);
insert into public.faro_plans values ('free','Free',1,2,10),('pro','Pro',3,12,100),('business','Business',10,40,500);
create table public.faro_workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
 name text not null check(length(trim(name)) between 1 and 80),
 plan_code text not null default 'free' references public.faro_plans(code),
 created_at timestamptz not null default now()
);
create table public.faro_brands (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.faro_workspaces(id) on delete cascade,
 slot integer not null check(slot between 1 and 100),
 name text not null check(length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(workspace_id,slot)
);
create table public.faro_connections (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.faro_brands(id) on delete cascade,
 provider text not null check(provider in ('youtube','facebook','instagram','tiktok')),
 external_account_id text not null,
 display_name text not null,
 status text not null check(status in ('connected','expired','revoked','error')),
 updated_at timestamptz not null default now(),
 unique(brand_id,provider,external_account_id)
);
create index faro_connections_brand_idx on public.faro_connections(brand_id);
alter table public.faro_plans enable row level security;
alter table public.faro_workspaces enable row level security;
alter table public.faro_brands enable row level security;
alter table public.faro_connections enable row level security;
revoke all on public.faro_plans,public.faro_workspaces,public.faro_brands,public.faro_connections from public,anon,authenticated;
grant select on public.faro_plans,public.faro_workspaces,public.faro_brands,public.faro_connections to authenticated;
grant insert(name) on public.faro_workspaces to authenticated;
grant insert(workspace_id,slot,name) on public.faro_brands to authenticated;
create policy plans_read on public.faro_plans for select to authenticated
 using ((select auth.jwt()->'app_metadata'->'farosocial_access')='true'::jsonb);
create policy workspaces_read on public.faro_workspaces for select to authenticated
 using (owner_id=(select auth.uid()) and (select auth.jwt()->'app_metadata'->'farosocial_access')='true'::jsonb);
create policy workspaces_create on public.faro_workspaces for insert to authenticated
 with check (owner_id=(select auth.uid()) and plan_code='free' and (select auth.jwt()->'app_metadata'->'farosocial_access')='true'::jsonb);
create policy brands_read on public.faro_brands for select to authenticated
 using (exists(select 1 from public.faro_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy brands_create on public.faro_brands for insert to authenticated
 with check (exists(select 1 from public.faro_workspaces w join public.faro_plans p on p.code=w.plan_code
 where w.id=workspace_id and w.owner_id=(select auth.uid()) and faro_brands.slot between 1 and p.max_brands));
create policy connections_read on public.faro_connections for select to authenticated
 using (exists(select 1 from public.faro_brands b join public.faro_workspaces w on w.id=b.workspace_id
 where b.id=brand_id and w.owner_id=(select auth.uid())));
-- Las plazas únicas y RLS limitan las marcas. Conexiones y publicaciones todavía no tienen cuotas operativas.
-- No conceder permisos de escritura a clientes sobre plan_code, conexiones ni owner_id.
-- Administración 0.5: reporte limitado, sin acceso directo global a las tablas.
-- Mantener faro_private fuera de los esquemas expuestos de PostgREST.
create schema faro_private;
revoke all on schema faro_private from public,anon,authenticated;
grant usage on schema faro_private to authenticated;
create function faro_private.admin_report(p_page integer, p_plan text)
returns jsonb language plpgsql security definer stable set search_path='' as $
declare result jsonb;
begin
 if auth.uid() is null or not exists (
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
   and u.raw_app_meta_data->'farosocial_access'='true'::jsonb
   and u.raw_app_meta_data->'farosocial_admin'='true'::jsonb
   and (u.banned_until is null or u.banned_until < now())
 ) then raise exception 'Acceso administrativo denegado' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>10000 or p_plan is null
  or p_plan not in ('all','free','pro','business') then
  raise exception 'Filtro no válido' using errcode='22023'; end if;
 select jsonb_build_object(
  'workspaces',(select count(*) from public.faro_workspaces),
  'brands',(select count(*) from public.faro_brands),
  'connected',(select count(*) from public.faro_connections where status='connected'),
  'incidents',(select count(*) from public.faro_connections where status in ('expired','error')),
  'filtered',(select count(*) from public.faro_workspaces w where p_plan='all' or w.plan_code=p_plan),
  'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
    select w.id,w.name,w.plan_code,w.created_at,
    (select count(*) from public.faro_brands b where b.workspace_id=w.id) as brands,
    (select count(*) from public.faro_connections c join public.faro_brands b on b.id=c.brand_id where b.workspace_id=w.id and c.status='connected') as connected
    from public.faro_workspaces w where p_plan='all' or w.plan_code=p_plan
    order by w.created_at desc,w.id desc limit 25 offset p_page*25
  ) x),'[]'::jsonb)
 ) into result;
 return result;
end;
$;
revoke all on function faro_private.admin_report(integer,text) from public,anon,authenticated;
grant execute on function faro_private.admin_report(integer,text) to authenticated;
create function public.faro_admin_report(p_page integer,p_plan text)
returns jsonb language sql security invoker stable set search_path='' as $
 select faro_private.admin_report(p_page,p_plan);
$;
revoke all on function public.faro_admin_report(integer,text) from public,anon,authenticated;
grant execute on function public.faro_admin_report(integer,text) to authenticated;

commit;
