// All requests use a transaction-local identity and the NOLOGIN read-only role.
export const queries=Object.freeze({
 '/v1/me':'select id,role from faro.accounts limit 1',
 '/v1/workspaces':'select w.id,w.name,w.plan_code,p.max_brands,p.max_connections,p.max_monthly_posts from faro.workspaces w join faro.plans p on p.code=w.plan_code order by w.created_at desc limit 100',
 '/v1/brands':'select id,name,slot,created_at from faro.brands where workspace_id=$1::uuid order by slot limit 100',
 '/v1/drafts':'select id,brand_id,title,description,platform_mask,planned_date,planned_time,media_id from faro.drafts where brand_id=$1::uuid order by created_at desc,id desc limit 200'
});
export function createReader(pool){return async(subject,path,id)=>{
 const query=queries[path];if(!Object.hasOwn(queries,path))throw Error('Unknown route');
 const c=await pool.connect();let broken=false;
 try{
  await c.query('begin read only');
  await c.query("set local statement_timeout = '5s'");
  await c.query('set local role faro_api');
  await c.query("select set_config('faro.subject',$1,true)",[subject]);
  const account=await c.query('select id from faro.accounts limit 1');
  if(account.rowCount!==1){await c.query('rollback');return null}
  const result=await c.query(query,id?[id]:[]);
  await c.query('commit');return result.rows;
 }catch(e){try{await c.query('rollback')}catch{broken=true}throw e}
 finally{c.release(broken?true:undefined)}
}}
