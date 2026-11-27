-- Development migration; no direct browser credentials. Pending reservations count toward quota.
BEGIN;
alter table faro.media add column upload_state text not null default 'pending' check(upload_state in ('pending','ready'));
grant insert(id,brand_id,name,mime_type,byte_size),update(upload_state) on faro.media to faro_api;
create policy media_insert on faro.media for insert to faro_api with check (upload_state='pending' and exists(select 1 from faro.brands b where b.id=brand_id));
create policy media_ready on faro.media for update to faro_api using (upload_state='pending' and exists(select 1 from faro.brands b where b.id=brand_id)) with check (upload_state='ready' and exists(select 1 from faro.brands b where b.id=brand_id));
grant insert(media_id),update(media_id) on faro.drafts to faro_api;
alter policy draft_create on faro.drafts with check (exists(select 1 from faro.brands b where b.id=brand_id) and (media_id is null or exists(select 1 from faro.media m where m.id=media_id and m.brand_id=faro.drafts.brand_id and m.upload_state='ready')));
alter policy draft_update on faro.drafts with check (exists(select 1 from faro.brands b where b.id=brand_id) and (media_id is null or exists(select 1 from faro.media m where m.id=media_id and m.brand_id=faro.drafts.brand_id and m.upload_state='ready')));
COMMIT;
