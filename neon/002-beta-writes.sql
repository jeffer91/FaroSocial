-- Development migration; run once. No automatic account approval.
BEGIN;
create table faro.access_requests (auth_subject uuid primary key, requested_at timestamptz not null default now());
alter table faro.access_requests enable row level security;
revoke all on faro.access_requests from public;
grant insert(auth_subject),select(auth_subject) on faro.access_requests to faro_api;
create policy request_insert on faro.access_requests for insert to faro_api with check (auth_subject::text=nullif(current_setting('faro.subject',true),''));
create policy request_read on faro.access_requests for select to faro_api using (auth_subject::text=nullif(current_setting('faro.subject',true),''));
grant insert(owner_id,name) on faro.workspaces to faro_api;
create policy workspace_create on faro.workspaces for insert to faro_api with check (plan_code='free' and exists(select 1 from faro.accounts a where a.id=owner_id));
grant insert(workspace_id,slot,name) on faro.brands to faro_api;
create policy brand_create on faro.brands for insert to faro_api with check (exists(select 1 from faro.workspaces w join faro.plans p on p.code=w.plan_code where w.id=workspace_id and faro.brands.slot between 1 and p.max_brands));
grant insert(id,brand_id,title,description,platform_mask,planned_date,planned_time),update(title,description,platform_mask,planned_date,planned_time) on faro.drafts to faro_api;
create policy draft_create on faro.drafts for insert to faro_api with check (media_id is null and exists(select 1 from faro.brands b where b.id=brand_id));
create policy draft_update on faro.drafts for update to faro_api using (exists(select 1 from faro.brands b where b.id=brand_id)) with check (exists(select 1 from faro.brands b where b.id=brand_id));
COMMIT;
