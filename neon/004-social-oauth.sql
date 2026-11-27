-- Isolated development migration. No external credentials installed.
BEGIN;
create role faro_social nologin nobypassrls;
grant faro_api to faro_social;
grant faro_social to current_user;
grant usage on schema faro_private to faro_social;
create table faro_private.oauth_attempts (auth_subject uuid not null,provider text not null check(provider in ('youtube','facebook','instagram','tiktok')),brand_id uuid not null references faro.brands(id), state_hash text not null unique check(length(state_hash)=64), verifier text not null check(length(verifier) between 43 and 128), expires_at timestamptz not null, consumed_at timestamptz, primary key(auth_subject,provider));
create table faro_private.social_credentials (connection_id uuid primary key references faro.connections(id) on delete restrict, ciphertext text not null, key_version integer not null default 1 check(key_version>0), updated_at timestamptz not null default now());
alter table faro_private.oauth_attempts enable row level security;
alter table faro_private.social_credentials enable row level security;
revoke all on faro_private.oauth_attempts,faro_private.social_credentials from public;
grant select,insert,update on faro_private.oauth_attempts to faro_social;
create policy oauth_own on faro_private.oauth_attempts for all to faro_social using (auth_subject::text=nullif(current_setting('faro.subject',true),'') and exists(select 1 from faro.brands b where b.id=brand_id)) with check (auth_subject::text=nullif(current_setting('faro.subject',true),'') and exists(select 1 from faro.brands b where b.id=brand_id));
grant insert(brand_id,provider,external_account_id,display_name,status),update(display_name,status,updated_at) on faro.connections to faro_social;
create policy connections_insert on faro.connections for insert to faro_social with check (provider='youtube' and exists(select 1 from faro.brands b where b.id=brand_id));
create policy connections_update on faro.connections for update to faro_social using (provider='youtube' and exists(select 1 from faro.brands b where b.id=brand_id)) with check (provider='youtube' and exists(select 1 from faro.brands b where b.id=brand_id));
grant select(connection_id),insert(connection_id,ciphertext),update(ciphertext,updated_at) on faro_private.social_credentials to faro_social;
create policy credential_own on faro_private.social_credentials for all to faro_social using (exists(select 1 from faro.connections c where c.id=connection_id and c.provider='youtube')) with check (exists(select 1 from faro.connections c where c.id=connection_id and c.provider='youtube'));
COMMIT;
