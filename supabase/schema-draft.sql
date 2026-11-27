-- Borrador SaaS 0.4 para un proyecto nuevo y exclusivo. No aplicado.
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
commit;
