-- Development. Existing jobs remain unauthorized.
BEGIN;
alter table faro_private.publication_jobs add column authorized_at timestamptz, add column provider_reference text check(length(provider_reference) between 1 and 128), add column delivery_stage text not null default 'new' check(delivery_stage in ('new','container','processing','ready','publish_intent','poll_error','complete')), add column poll_count integer not null default 0 check(poll_count between 0 and 60);
alter table faro_private.publication_jobs drop constraint publication_jobs_status_check, add constraint publication_jobs_status_check check(status in ('queued','processing','retry','awaiting','succeeded','review','failed','cancelled'));
alter table faro_private.publication_jobs drop constraint publication_jobs_check1, add constraint publication_jobs_confirmation_check check(status<>'succeeded' or (delivery_stage='complete' and (external_post_id is not null or provider_reference is not null)));
alter table faro_private.publication_jobs add constraint publication_jobs_pending_check check(status<>'awaiting' or provider_reference is not null);
grant select(provider_reference,delivery_stage,poll_count) on faro_private.publication_jobs to faro_queue;
grant update(provider_reference,delivery_stage,poll_count) on faro_private.publication_jobs to faro_worker;
alter policy worker_update on faro_private.publication_jobs using(status in ('queued','retry','awaiting','processing')) with check(status in ('processing','retry','awaiting','review','failed','succeeded'));
create index jobs_awaiting on faro_private.publication_jobs(available_at,id) where status='awaiting' and authorized_at is not null;
COMMIT;
