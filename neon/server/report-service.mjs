import {reportInput,summarize,accountMetrics} from './report-core.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createReports(pool){return async(subject,req)=>{
 let p;try{p=reportInput(new URL(req.url))}catch{return json({error:'Período o marca inválidos'},400)}
 const c=await pool.connect();let broken=false;
 try{
 await c.query('begin isolation level repeatable read read only');
 await c.query("set local statement_timeout='5s'");await c.query('set local role faro_queue');await c.query("select set_config('faro.subject',$1,true)",[subject]);
 if(!(await c.query('select id from faro.brands where id=$1',[p.brand])).rowCount){await c.query('rollback');return json({error:'Marca no disponible'},403)}
 const grouped=(await c.query("select k.provider,j.status,count(*)::int as count from faro_private.publication_jobs j join faro.connections k on k.id=j.connection_id where j.brand_id=$1 and j.scheduled_at >= $2::date::timestamp at time zone 'UTC' and j.scheduled_at < $3::date::timestamp at time zone 'UTC' group by k.provider,j.status",[p.brand,p.from,p.end])).rows;
 const daily=(await c.query("select to_char(j.scheduled_at at time zone 'UTC','YYYY-MM-DD') as day,count(*)::int as count from faro_private.publication_jobs j where j.brand_id=$1 and j.scheduled_at >= $2::date::timestamp at time zone 'UTC' and j.scheduled_at < $3::date::timestamp at time zone 'UTC' group by 1 order by 1",[p.brand,p.from,p.end])).rows;
 const accounts=(await c.query("select k.id,k.provider,k.display_name,k.status,f.observed_on::text as first_day,l.observed_on::text as last_day,f.followers as first_followers,l.followers as last_followers,f.lifetime_views as first_views,l.lifetime_views as last_views,f.lifetime_posts as first_posts,l.lifetime_posts as last_posts from faro.connections k left join lateral (select observed_on,followers,lifetime_views,lifetime_posts from faro.social_snapshots where connection_id=k.id and observed_on between $2::date and $3::date order by observed_on asc limit 1) f on true left join lateral (select observed_on,followers,lifetime_views,lifetime_posts from faro.social_snapshots where connection_id=k.id and observed_on between $2::date and $3::date order by observed_on desc limit 1) l on true where k.brand_id=$1 order by k.provider,k.display_name",[p.brand,p.from,p.to])).rows;
 await c.query('commit');return json({data:{period:{from:p.from,to:p.to,timezone:'UTC'},...summarize(grouped),daily,accounts:accounts.map(accountMetrics),source:'FaroSocial',external_sync_enabled:false}});
 }catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}
}}
