import {validatePlanRequest,validateCancel,quota,utcMonth} from './billing-core.mjs';
import {readJson} from './write-validation.mjs';
import {validId} from './queue-validation.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createBilling(pool){return async(subject,req)=>{
 const u=new URL(req.url),path=u.pathname;let input;
 try{if(req.method==='GET'){if(path!=='/v1/billing'||[...u.searchParams.keys()].length!==1||!validId(u.searchParams.get('workspace')))throw Error();input={workspace_id:u.searchParams.get('workspace')}}
 else if(req.method==='POST'&&!u.search){const b=await readJson(req);input=path==='/v1/billing/request'?validatePlanRequest(b):path==='/v1/billing/cancel'?validateCancel(b):null;if(!input)throw Error()}
 else throw Error()}catch{return reply({error:'Solicitud inválida'},400)}
 const c=await pool.connect();let broken=false;
 try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role faro_queue');await c.query("select set_config('faro.subject',$1,true)",[subject]);
 if(!(await c.query('select id from faro.accounts limit 1')).rowCount){await c.query('rollback');return reply({error:'Cuenta no habilitada'},403)}
 let result;
 if(req.method==='GET'){
 const w=(await c.query('select w.id,w.plan_code,p.name,p.max_brands,p.max_connections,p.max_monthly_posts from faro.workspaces w join faro.plans p on p.code=w.plan_code where w.id=$1',[input.workspace_id])).rows[0];if(!w){await c.query('rollback');return reply({error:'Espacio no disponible'},403)}
 const plans=(await c.query('select code,name,max_brands,max_connections,max_monthly_posts from faro.plans order by max_brands')).rows;
 const [from,to]=utcMonth();
 const counts=(await c.query("select (select count(*)::int from faro.brands where workspace_id=$1) as brands,(select count(*)::int from faro.connections c join faro.brands b on b.id=c.brand_id where b.workspace_id=$1 and c.status='connected') as connections,(select count(*)::int from faro_private.publication_jobs j join faro.brands b on b.id=j.brand_id where b.workspace_id=$1 and j.scheduled_at >= $2 and j.scheduled_at < $3 and j.status<>'cancelled') as posts",[w.id,from,to])).rows[0];
 const requests=(await c.query('select id,requested_plan,status,created_at,resolved_at from faro.plan_requests where workspace_id=$1 order by created_at desc limit 30',[w.id])).rows;
 const sub=(await c.query('select provider,state,period_end from faro.billing_subscriptions where workspace_id=$1',[w.id])).rows[0]??null;
 result={data:{plan:w.plan_code,plans,usage:{brands:quota(counts.brands,w.max_brands),connections:quota(counts.connections,w.max_connections),posts:quota(counts.posts,w.max_monthly_posts)},period:{from,to,timezone:'UTC'},requests,subscription:sub,checkout_enabled:false,prices_configured:false}};
 }else if(path==='/v1/billing/request'){
 const r=await c.query("insert into faro.plan_requests(workspace_id,requested_plan) select id,$2 from faro.workspaces where id=$1 and plan_code<>$2 on conflict(workspace_id) where status='pending' do nothing returning id,requested_plan,status",[input.workspace_id,input.requested_plan]);
 if(!r.rowCount){await c.query('rollback');return reply({error:'Solicitud pendiente o plan no disponible'},409)}result={data:r.rows[0]};
 }else{const r=await c.query("update faro.plan_requests set status='cancelled',resolved_at=now() where id=$1 and status='pending' returning id,status",[input.id]);if(!r.rowCount){await c.query('rollback');return reply({error:'Solicitud no disponible'},409)}result={data:r.rows[0]}}
 await c.query('commit');return reply(result,req.method==='POST'?201:200)
 }catch(e){try{await c.query('rollback')}catch{broken=true}if(['23505','23503','42501','23514'].includes(e.code))return reply({error:'Operación no permitida'},409);throw e}finally{c.release(broken?true:undefined)}
}}
