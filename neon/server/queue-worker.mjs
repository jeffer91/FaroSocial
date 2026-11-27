import {randomUUID} from 'node:crypto';
const claimSql="with candidate as (select id from faro_private.publication_jobs where status in ('queued','retry') and available_at<=now() and attempts<3 order by available_at,id for update skip locked limit 1) update faro_private.publication_jobs j set status='processing',attempts=j.attempts+1,lease_id=$1,lease_expires_at=now()+interval '10 minutes' from candidate c where j.id=c.id returning j.*";
export function createWorker(pool,{dispatch=null,enabled=false}={}){
 // No route, trigger or dispatch implementation is installed in this release.
 async function tx(fn){const c=await pool.connect();let broken=false;try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role faro_worker');const r=await fn(c);await c.query('commit');return r}catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}}
 async function tick(){
 if(!enabled||typeof dispatch!=='function')return {disabled:true};
 const job=await tx(async c=>{await c.query("update faro_private.publication_jobs set status='review',lease_id=null,lease_expires_at=null where status='processing' and lease_expires_at<=now()");return (await c.query(claimSql,[randomUUID()])).rows[0]});
 if(!job)return {idle:true};
 let result;try{result=await dispatch(job)}catch{result={outcome:'unknown'}}
 const success=result?.outcome==='success'&&typeof result.external_post_id==='string'&&result.external_post_id.trim().length>0;
 const status=success?'succeeded':result?.outcome==='permanent'?'failed':result?.outcome==='safe_retry'?(job.attempts<3?'retry':'failed'):'review';
 const updated=await tx(async c=>(await c.query("update faro_private.publication_jobs set status=$3,lease_id=null,lease_expires_at=null,external_post_id=$4,available_at=case when $3='retry' then now()+make_interval(secs=>$5) else available_at end where id=$1 and lease_id=$2 and status='processing' and lease_expires_at>now() returning id",[job.id,job.lease_id,status,success?result.external_post_id:null,60*2**(job.attempts-1)])).rowCount);
 return {status:updated===1?status:'review',id:job.id};
 }
 return {tick};
}
