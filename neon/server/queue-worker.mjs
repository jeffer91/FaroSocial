import {randomUUID} from 'node:crypto';
import {transition} from './delivery-transition.mjs';
// Legacy rehearsal jobs cannot be sent: authorization is NULL and no role can set it.
// No trigger, HTTP route, or live dispatcher is installed.
const claimSql="with candidate as (select id from faro_private.publication_jobs where authorized_at is not null and available_at<=now() and ((status in ('queued','retry') and attempts<3) or (status='awaiting' and poll_count<60)) order by available_at,id for update skip locked limit 1) update faro_private.publication_jobs j set status='processing',attempts=j.attempts+case when j.status in ('queued','retry') then 1 else 0 end,poll_count=j.poll_count+case when j.status='awaiting' then 1 else 0 end,delivery_stage=case when j.delivery_stage='ready' and j.payload->>'provider'='instagram' then 'publish_intent' else j.delivery_stage end,lease_id=$1,lease_expires_at=now()+interval '10 minutes' from candidate c where j.id=c.id returning j.*";
export function createWorker(pool,{dispatch=null,enabled=false}={}){
 async function tx(fn){const c=await pool.connect();let broken=false;try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role faro_worker');const r=await fn(c);await c.query('commit');return r}catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}}
 async function tick(){
 if(!enabled||typeof dispatch!=='function')return {disabled:true};
 const job=await tx(async c=>{await c.query("update faro_private.publication_jobs set status='review',lease_id=null,lease_expires_at=null where status='processing' and lease_expires_at<=now()");return (await c.query(claimSql,[randomUUID()])).rows[0]});
 if(!job)return {idle:true};
 let result;try{result=await dispatch(job)}catch{result={outcome:'unknown'}}
 const t=transition(job,result);
 const updated=await tx(async c=>(await c.query("update faro_private.publication_jobs set status=$3,lease_id=null,lease_expires_at=null,external_post_id=$4,provider_reference=$5,delivery_stage=$6,available_at=case when $3 in ('retry','awaiting') then now()+make_interval(secs=>$7) else available_at end where id=$1 and lease_id=$2 and status='processing' and lease_expires_at>now() returning id",[job.id,job.lease_id,t.status,t.external,t.reference,t.stage,t.delay])).rowCount);
 return {status:updated===1?t.status:'review',id:job.id};
 }
 return {tick};
}
