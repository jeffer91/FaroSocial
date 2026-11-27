-- Isolated development migration.
BEGIN;
alter policy connections_insert on faro.connections with check (provider in ('youtube','facebook','instagram','tiktok') and exists(select 1 from faro.brands b where b.id=brand_id));
alter policy connections_update on faro.connections using (provider in ('youtube','facebook','instagram','tiktok') and exists(select 1 from faro.brands b where b.id=brand_id)) with check (provider in ('youtube','facebook','instagram','tiktok') and exists(select 1 from faro.brands b where b.id=brand_id));
alter policy credential_own on faro_private.social_credentials using (exists(select 1 from faro.connections c where c.id=connection_id and c.provider in ('youtube','facebook','instagram','tiktok'))) with check (exists(select 1 from faro.connections c where c.id=connection_id and c.provider in ('youtube','facebook','instagram','tiktok')));
COMMIT;
