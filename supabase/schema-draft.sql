-- Propuesta inicial para un proyecto dedicado. NO aplicada todavía.
-- Ejecutar solo tras verificar el proyecto y revisar las políticas.
begin;
create table public.faro_brands (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now()
);
create index faro_brands_owner_idx on public.faro_brands(user_id);
alter table public.faro_brands enable row level security;
revoke all on public.faro_brands from public, anon, authenticated;
grant select on public.faro_brands to authenticated;
grant insert (name) on public.faro_brands to authenticated;
create policy faro_brands_read_own on public.faro_brands for select to authenticated using ((select auth.uid()) = user_id and (select auth.jwt()->'app_metadata'->'farosocial_access') = 'true'::jsonb);
create policy faro_brands_create_own on public.faro_brands for insert to authenticated with check ((select auth.uid()) = user_id and (select auth.jwt()->'app_metadata'->'farosocial_access') = 'true'::jsonb);

-- Vista lógica de las conexiones: nunca guardar tokens en esta tabla pública.
-- Las futuras funciones de servidor serán las únicas que puedan modificar estados.
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
alter table public.faro_connections enable row level security;
revoke all on public.faro_connections from public, anon, authenticated;
grant select on public.faro_connections to authenticated;
create policy faro_connections_read_own on public.faro_connections for select to authenticated using ((select auth.jwt()->'app_metadata'->'farosocial_access') = 'true'::jsonb and exists(select 1 from public.faro_brands b where b.id=brand_id and b.user_id=(select auth.uid())));
commit;
