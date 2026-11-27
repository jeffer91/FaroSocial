-- Read-only external snapshots, no synthetic metrics.
BEGIN;
create table faro.social_snapshots (connection_id uuid not null,brand_id uuid not null,observed_on date not null, followers bigint check(followers>=0), lifetime_views bigint check(lifetime_views>=0), lifetime_posts bigint check(lifetime_posts>=0), observed_at timestamptz not null default now(), primary key(connection_id,observed_on), foreign key(brand_id,connection_id) references faro.connections(brand_id,id), check(followers is not null or lifetime_views is not null or lifetime_posts is not null));
alter table faro.social_snapshots enable row level security;
revoke all on faro.social_snapshots from public;
grant select on faro.social_snapshots to faro_queue;
create policy snapshots_read on faro.social_snapshots for select to faro_queue using (exists(select 1 from faro.brands b where b.id=brand_id));
create index snapshots_brand_day on faro.social_snapshots(brand_id,observed_on,connection_id);
COMMIT;
