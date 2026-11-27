-- Approved launch catalog. No checkout, charges or automatic upgrade.
BEGIN;
alter table faro.plans drop constraint plans_code_check, add constraint plans_code_check check(code in ('free','personal','pro','business'));
alter table faro.plans add column monthly_price_cents integer not null default 0 check(monthly_price_cents>=0), add column annual_price_cents integer not null default 0 check(annual_price_cents>=0), add column currency text not null default 'USD' check(currency='USD');
update faro.plans set max_brands=1,max_connections=4,max_monthly_posts=20,monthly_price_cents=0,annual_price_cents=0 where code='free';
insert into faro.plans(code,name,max_brands,max_connections,max_monthly_posts,monthly_price_cents,annual_price_cents) values('personal','Personal',1,4,200,599,5990);
update faro.plans set max_brands=5,max_connections=20,max_monthly_posts=1000,monthly_price_cents=1599,annual_price_cents=15990 where code='pro';
update faro.plans set max_brands=10,max_connections=40,max_monthly_posts=3000,monthly_price_cents=2999,annual_price_cents=29990 where code='business';
alter table faro.plans add constraint plans_price_consistency check((code='free' and monthly_price_cents=0 and annual_price_cents=0) or (code<>'free' and monthly_price_cents>0 and annual_price_cents>0 and annual_price_cents<=12::bigint*monthly_price_cents));
COMMIT;
