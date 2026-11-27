import {randomUUID} from 'node:crypto';
import {readJson} from './write-validation.mjs';
import {validateSchedule,snapshot,monthBounds,validId} from './queue-validation.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createQueue(pool){
 async function tx(subject,fn){const c=await pool.connect();let broken=false;try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role faro_queue');await c.query("select set_config('faro.subject',$1,true)",[subject]);const a=await c.query('select id from faro.accounts limit 1');if(a.rowCount!==1){await c.query('rollback');return null}const r=await fn(c,a.rows[0].id);await c.query('commit');return r}catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}}
 return async(subject,req)=>{
 const url=new URL(req.url),path=url.pathname;
 if(path==='/v1/queue'&&req.method==='GET'){
 const brand=url.searchParams.get('brand');if([...url.searchParams.keys()].length!==1||!validId(brand))return json({error:'Marca inválida'},400);
 const rows=await tx(subject,async c=>(await c.query("select j.id,j.draft_id,j.scheduled_at,j.status,j.attempts,j.external_post_id,j.payload->>'title' as title,k.provider,k.display_name from faro_private.publication_jobs j join faro.connections k on k.id=j.connection_id where j.brand_id=$1 order by j.scheduled_at desc,j.id limit 200",[brand])).rows);
 return rows===null?json({error:'Cuenta no habilitada'},403):json({data:rows});
 }
 if(req.method!=='POST'||url.search)return json({error:'Solicitud inválida'},400);
 let b;try{b=await readJson(req)}catch{return json({error:'Datos inválidos'},400)}
 if(path==='/v1/queue/cancel'){
 if(!b||Object.keys(b).length!==1||!validId(b.id))return json({error:'Trabajo inválido'},400);
 const result=await tx(subject,async c=>(await c.query("update faro_private.publication_jobs set status='cancelled' where id=$1 and status in ('queued','retry') returning id",[b.id])).rowCount);
 return result===null?json({error:'Cuenta no habilitada'},403):result===1?json({data:{cancelled:true}}):json({error:'Trabajo no disponible'},409);
 }
 if(path!=='/v1/queue')return json({error:'Ruta inválida'},404);
 let input;try{input=validateSchedule(b)}catch{return json({error:'Fecha, hora o cuentas inválidas'},400)}
 const result=await tx(subject,async(c,account)=>{
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,2))',[account]);
 const d=(await c.query('select id,brand_id,title,description,platform_mask,media_id from faro.drafts where id=$1',[input.draft_id])).rows[0];if(!d)return {error:'Borrador no disponible'};
 const connections=(await c.query('select id,brand_id,provider,status from faro.connections where id=any($1::uuid[]) and brand_id=$2',[input.connection_ids,d.brand_id])).rows;
 if(connections.length!==input.connection_ids.length)return {error:'Conexiones no disponibles'};
 const media=d.media_id?(await c.query('select id,brand_id,mime_type,byte_size,storage_path,upload_state from faro.media where id=$1',[d.media_id])).rows[0]:null;
 let payload;try{payload=snapshot(d,connections,media)}catch(e){return {error:e.message}}
 const plan=(await c.query('select w.id,p.max_monthly_posts from faro.brands b join faro.workspaces w on w.id=b.workspace_id join faro.plans p on p.code=w.plan_code where b.id=$1',[d.brand_id])).rows[0];if(!plan)return {error:'Plan no disponible'};
 const [start,end]=monthBounds(input.scheduled_at);
 const n=(await c.query("select count(*)::int as count from faro_private.publication_jobs j join faro.brands b on b.id=j.brand_id where b.workspace_id=$1 and j.scheduled_at >= $2 and j.scheduled_at < $3 and j.status <> 'cancelled'",[plan.id,start,end])).rows[0].count;
 if(n+connections.length>plan.max_monthly_posts)return {error:'Cupo mensual agotado'};
 const existing=await c.query('select id from faro_private.publication_jobs where draft_id=$1 and connection_id=any($2::uuid[]) limit 1',[d.id,input.connection_ids]);if(existing.rowCount)return {error:'Ya existe una programación para el borrador y cuenta'};
 const jobs=[];for(const k of connections){const r=await c.query('insert into faro_private.publication_jobs(brand_id,draft_id,connection_id,request_key,payload,scheduled_at,available_at) values($1,$2,$3,$4,$5::jsonb,$6,$6) returning id',[d.brand_id,d.id,k.id,randomUUID(),JSON.stringify({...payload,provider:k.provider,offset:input.offset}),input.scheduled_at]);jobs.push(r.rows[0].id)}
 return {jobs};
 });
 return result===null?json({error:'Cuenta no habilitada'},403):result.error?json({error:result.error},409):json({data:result},201);
 }
}
