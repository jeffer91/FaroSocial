-- Meta connections on isolated development branch.
BEGIN;
alter policy connections_insert on faro.connections with check (provider in ('youtube','facebook','instagram') and exists(select 1 from faro.brands b where b.id=brand_id));
alter policy connections_update on faro.connections using (provider in ('youtube','facebook','instagram') and exists(select 1 from faro.brands b where b.id=brand_id)) with check (provider in ('youtube','facebook','instagram') and exists(select 1 from faro.brands b where b.id=brand_id));
alter policy credential_own on faro_private.social_credentials using (exists(select 1 from faro.connections c where c.id=connection_id and c.provider in ('youtube','facebook','instagram'))) with check (exists(select 1 from faro.connections c where c.id=connection_id and c.provider in ('youtube','facebook','instagram')));
create table faro_private.meta_choices (id uuid primary key, auth_subject uuid not null,provider text not null check(provider in ('facebook','instagram')),brand_id uuid not null references faro.brands(id),ciphertext text not null,expires_at timestamptz not null,consumed_at timestamptz,unique(auth_subject,provider));
alter table faro_private.meta_choices enable row level security;
revoke all on faro_private.meta_choices from public;
grant select,insert,update on faro_private.meta_choices to faro_social;
create policy meta_own on faro_private.meta_choices for all to faro_social using (auth_subject::text=nullif(current_setting('faro.subject',true),'') and exists(select 1 from faro.brands b where b.id=brand_id)) with check (auth_subject::text=nullif(current_setting('faro.subject',true),'') and exists(select 1 from faro.brands b where b.id=brand_id));
COMMIT;
