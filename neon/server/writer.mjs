export function createWriter(pool){return async(subject,path,b,method)=>{
 const c=await pool.connect();let broken=false;
 try{
  await c.query('begin');
  await c.query("set local statement_timeout = '5s'");
  await c.query('set local role faro_api');
  await c.query("select set_config('faro.subject',$1,true)",[subject]);
  if(path==='/v1/access-request'){
   await c.query('insert into faro.access_requests(auth_subject) values($1) on conflict(auth_subject) do nothing',[subject]);
   await c.query('commit');return {status:202,data:{requested:true}};
  }
  const a=await c.query('select id from faro.accounts limit 1');if(a.rowCount!==1){await c.query('rollback');return {status:403,error:'Cuenta no habilitada'}}
  let result;
  if(path==='/v1/workspaces')result=await c.query("insert into faro.workspaces(owner_id,name) values($1,$2) returning id,name",[a.rows[0].id,b.name]);
  else if(path==='/v1/brands')result=await c.query("insert into faro.brands(workspace_id,slot,name) select w.id,s.slot,$2 from faro.workspaces w join faro.plans p on p.code=w.plan_code cross join lateral generate_series(1,p.max_brands) s(slot) where w.id=$1 and not exists(select 1 from faro.brands b where b.workspace_id=w.id and b.slot=s.slot) order by s.slot limit 1 returning id,name,slot",[b.workspace_id,b.name]);
  else if(path==='/v1/drafts'){
   const args=[b.id,b.brand_id,b.title,b.description,b.platform_mask,b.planned_date,b.planned_time,b.media_id];
   result=method==='PATCH'?await c.query("update faro.drafts set title=$3,description=$4,platform_mask=$5,planned_date=$6,planned_time=$7,media_id=$8 where id=$1 and brand_id=$2 returning id",args):await c.query("insert into faro.drafts(id,brand_id,title,description,platform_mask,planned_date,planned_time,media_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id",args);
  }else throw Error('Unknown route');
  if(result.rowCount!==1){await c.query('rollback');return {status:409,error:'Recurso no disponible o cupo agotado'}}
  await c.query('commit');return {status:method==='PATCH'?200:201,data:result.rows[0]};
 }catch(e){try{await c.query('rollback')}catch{broken=true}if(['23505','23503','23514','42501','22P02'].includes(e.code))return {status:409,error:'Operación no permitida o conflicto. Actualiza antes de reintentar.'};throw e}
 finally{c.release(broken?true:undefined)}
}}
