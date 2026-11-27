-- Isolated development. No payment or plan change.
BEGIN;
create table faro.plan_requests (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references faro.workspaces(id) on delete restrict,requested_plan text not null references faro.plans(code),status text not null default 'pending' check(status in ('pending','cancelled','rejected','approved')),created_at timestamptz not null default now(),resolved_at timestamptz,check((status='pending')=(resolved_at is null)));
create unique index one_pending_plan_request on faro.plan_requests(workspace_id) where status='pending';
alter table faro.plan_requests enable row level security;
revoke all on faro.plan_requests from public;
grant select,insert(workspace_id,requested_plan),update(status,resolved_at) on faro.plan_requests to faro_queue;
create policy plan_request_read on faro.plan_requests for select to faro_queue using(exists(select 1 from faro.workspaces w where w.id=workspace_id));
create policy plan_request_insert on faro.plan_requests for insert to faro_queue with check(status='pending' and resolved_at is null and exists(select 1 from faro.workspaces w where w.id=workspace_id and w.plan_code<>requested_plan));
create policy plan_request_cancel on faro.plan_requests for update to faro_queue using(status='pending' and exists(select 1 from faro.workspaces w where w.id=workspace_id)) with check(status='cancelled' and resolved_at is not null and exists(select 1 from faro.workspaces w where w.id=workspace_id));
create table faro.billing_subscriptions (workspace_id uuid primary key references faro.workspaces(id) on delete restrict,provider text not null check(provider in ('manual','external')),state text not null check(state in ('inactive','trialing','active','past_due','cancelled')),period_end timestamptz,updated_at timestamptz not null default now());
alter table faro.billing_subscriptions enable row level security;
revoke all on faro.billing_subscriptions from public;
grant select on faro.billing_subscriptions to faro_queue;
create policy subscription_read on faro.billing_subscriptions for select to faro_queue using(exists(select 1 from faro.workspaces w where w.id=workspace_id));
COMMIT;
