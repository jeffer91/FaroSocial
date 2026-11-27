-- Development only. No trigger, no live delivery. Role separated from editorial.
BEGIN;
create role faro_queue nologin nobypassrls;
grant faro_api to faro_queue;
grant faro_queue to current_user;
grant usage on schema faro_private to faro_queue;
grant select(id,brand_id,draft_id,connection_id,request_key,payload,scheduled_at,available_at,status,attempts,external_post_id,created_at),insert(brand_id,draft_id,connection_id,request_key,payload,scheduled_at,available_at),update(status) on faro_private.publication_jobs to faro_queue;
create policy queue_read on faro_private.publication_jobs for select to faro_queue using (exists(select 1 from faro.brands b where b.id=brand_id));
create policy queue_insert on faro_private.publication_jobs for insert to faro_queue with check (status='queued' and attempts=0 and exists(select 1 from faro.brands b where b.id=brand_id) and exists(select 1 from faro.connections c where c.id=connection_id and c.brand_id=publication_jobs.brand_id and c.status='connected'));
create policy queue_cancel on faro_private.publication_jobs for update to faro_queue using (status in ('queued','retry') and exists(select 1 from faro.brands b where b.id=brand_id)) with check(status='cancelled' and exists(select 1 from faro.brands b where b.id=brand_id));
create index jobs_brand_schedule on faro_private.publication_jobs(brand_id,scheduled_at);
create role faro_worker nologin nobypassrls;
grant faro_worker to current_user;
grant usage on schema faro_private to faro_worker;
grant select,update(status,attempts,lease_id,lease_expires_at,available_at,external_post_id) on faro_private.publication_jobs to faro_worker;
create policy worker_read on faro_private.publication_jobs for select to faro_worker using (true);
create policy worker_update on faro_private.publication_jobs for update to faro_worker using(status in ('queued','retry','processing')) with check(status in ('processing','retry','review','failed','succeeded'));
COMMIT;
