-- FaroSocial 0.10. Apply with a database owner on a development branch first.
-- Trusted backend must set faro.subject transaction-locally from verified auth, never from request input.
-- faro_api NOLOGIN is read-only. No direct client DB access, no jobs or secrets accessible.
-- Run once, not idempotent. Main production branch remains untouched.
BEGIN;
create role faro_api nologin nobypassrls;

grant faro_api to current_user;

create schema faro;

create schema faro_private;

revoke all on schema faro, faro_private from public;

grant usage on schema faro to faro_api;

create table faro.accounts (
 id uuid primary key default gen_random_uuid(), auth_subject uuid not null unique,
 role text not null default 'customer' check (role in ('customer','admin')),
 enabled boolean not null default false, created_at timestamptz not null default now()
);

create table faro.plans (
 code text primary key check(code in ('free','pro','business')), name text not null,
 max_brands int not null check(max_brands between 1 and 100),
 max_connections int not null check(max_connections>0),
 max_monthly_posts int not null check(max_monthly_posts>0)
);

insert into faro.plans values ('free','Free',1,2,10),('pro','Pro',3,12,100),('business','Business',10,40,500);

create table faro.workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references faro.accounts(id) on delete restrict,
 name text not null check(length(trim(name)) between 1 and 80), plan_code text not null default 'free' references faro.plans(code),
 created_at timestamptz not null default now()
);

create table faro.brands (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references faro.workspaces(id) on delete restrict,
 slot integer not null check(slot between 1 and 100), name text not null check(length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(), unique(workspace_id,slot)
);

create table faro.connections (
 id uuid primary key default gen_random_uuid(), brand_id uuid not null references faro.brands(id) on delete restrict,
 provider text not null check(provider in ('youtube','facebook','instagram','tiktok')),
 external_account_id text not null, display_name text not null,
 status text not null check(status in ('connected','expired','revoked','error')),
 updated_at timestamptz not null default now(), unique(brand_id,provider,external_account_id), unique(brand_id,id)
);

create table faro.media (
 id uuid primary key, brand_id uuid not null references faro.brands(id) on delete restrict,
 name text not null check(length(name) between 1 and 180),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4')),
 byte_size integer not null check(byte_size>0 and byte_size<=case when mime_type='video/mp4' then 31457280 else 10485760 end),
 storage_path text generated always as (brand_id::text||'/'||id::text||case mime_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' when 'video/mp4' then '.mp4' end) stored unique,
 created_at timestamptz not null default now(), unique(brand_id,id)
);

create table faro.drafts (
 id uuid primary key, brand_id uuid not null references faro.brands(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 100),
 description text not null default '' check(length(description)<=2200),
 platform_mask integer not null check(platform_mask between 1 and 15),
 planned_date date check(planned_date between date '2000-01-01' and date '2099-12-31'),
 planned_time time check(planned_time is null or planned_date is not null),
 media_id uuid, created_at timestamptz not null default now(), unique(brand_id,id),
 foreign key(brand_id,media_id) references faro.media(brand_id,id)
);

create index drafts_brand_date on faro.drafts(brand_id,planned_date,id);

create table faro_private.publication_jobs (
 id uuid primary key default gen_random_uuid(), brand_id uuid not null, draft_id uuid not null, connection_id uuid not null,
 request_key uuid not null unique, payload jsonb not null check(jsonb_typeof(payload)='object'),
 scheduled_at timestamptz not null, available_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','processing','retry','succeeded','review','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 3), lease_id uuid, lease_expires_at timestamptz,
 external_post_id text, created_at timestamptz not null default now(),
 foreign key(brand_id,draft_id) references faro.drafts(brand_id,id),
 foreign key(brand_id,connection_id) references faro.connections(brand_id,id), unique(draft_id,connection_id),
 check((status='processing' and lease_id is not null and lease_expires_at is not null) or (status<>'processing' and lease_id is null and lease_expires_at is null)),
 check(status<>'succeeded' or external_post_id is not null)
);

create index jobs_ready on faro_private.publication_jobs(available_at,id) where status in ('queued','retry');

alter table faro.accounts enable row level security;

alter table faro.plans enable row level security;

alter table faro.workspaces enable row level security;

alter table faro.brands enable row level security;

alter table faro.connections enable row level security;

alter table faro.media enable row level security;

alter table faro.drafts enable row level security;

alter table faro_private.publication_jobs enable row level security;

revoke all on all tables in schema faro, faro_private from public;

grant select on faro.accounts,faro.plans,faro.workspaces,faro.brands,faro.connections,faro.media,faro.drafts to faro_api;

create policy account_read on faro.accounts for select to faro_api using (enabled and auth_subject::text = nullif(current_setting('faro.subject',true),''));

create policy plan_read on faro.plans for select to faro_api using (exists(select 1 from faro.accounts));

create policy workspace_read on faro.workspaces for select to faro_api using (exists(select 1 from faro.accounts a where a.id=owner_id));

create policy brand_read on faro.brands for select to faro_api using (exists(select 1 from faro.workspaces w where w.id=workspace_id));

create policy connections_read on faro.connections for select to faro_api using (exists(select 1 from faro.brands b where b.id=brand_id));

create policy media_read on faro.media for select to faro_api using (exists(select 1 from faro.brands b where b.id=brand_id));

create policy drafts_read on faro.drafts for select to faro_api using (exists(select 1 from faro.brands b where b.id=brand_id));
COMMIT;
