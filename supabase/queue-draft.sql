-- PROPUESTA NO APLICADA. Ejecutar solo después del esquema base y revisión.
-- No exponer faro_private mediante Data API. Sin permisos para clientes.
begin;
create table faro_private.publication_jobs (
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null references public.faro_drafts(id) on delete restrict,
 connection_id uuid not null references public.faro_connections(id) on delete restrict,
 request_key uuid not null unique,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 scheduled_at timestamptz not null,
 available_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','processing','retry','succeeded','review','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 lease_id uuid,
 lease_expires_at timestamptz,
 external_post_id text,
 created_at timestamptz not null default now(),
 unique(draft_id,connection_id),
 check((status='processing' and lease_id is not null and lease_expires_at is not null) or (status<>'processing' and lease_id is null and lease_expires_at is null)),
 check(status<>'succeeded' or external_post_id is not null)
);
create index publication_jobs_ready on faro_private.publication_jobs(available_at,id) where status in ('queued','retry');
alter table faro_private.publication_jobs enable row level security;
revoke all on faro_private.publication_jobs from public,anon,authenticated;
-- Antes de implementar el trabajador: validar en servidor propiedad y misma marca
-- de borrador/conexión, sesión, cuota, archivo y permisos del proveedor.
-- Encolado transaccional; claim con FOR UPDATE SKIP LOCKED y lease único.
-- Lease vencido => review (no reenvío automático).
-- Resultado incierto => review; solo reintentar si el proveedor confirma no envío.
-- No guardar tokens, secretos o respuestas crudas en payload.
commit;
