import {authorization,config,hash,exchange,seal} from './youtube-oauth.mjs';
import {readJson} from './write-validation.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createSocial(pool,env){
 async function tx(subject,fn){const c=await pool.connect();let broken=false;try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role faro_social');await c.query("select set_config('faro.subject',$1,true)",[subject]);const a=await c.query('select id from faro.accounts limit 1');if(a.rowCount!==1){await c.query('rollback');return null}const r=await fn(c,a.rows[0].id);await c.query('commit');return r}catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}}
 return async(subject,req)=>{
 const c=config(env),path=new URL(req.url).pathname;
 if(path==='/v1/social-status'){const a=await tx(subject,async()=>true);return a?reply({data:{youtube:Boolean(c),facebook:false,instagram:false,tiktok:false}}):reply({error:'Cuenta no habilitada'},403)}
 if(!c)return reply({error:'YouTube pendiente de configuración comercial'},503);
 let b;try{b=await readJson(req)}catch{return reply({error:'Datos inválidos'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Datos inválidos'},400);
 if(path==='/v1/youtube/start'){
  if(Object.keys(b).length!==1||typeof b.brand_id!=='string'||!UUID.test(b.brand_id))return reply({error:'Marca inválida'},400);
  const a=authorization(c);
  const saved=await tx(subject,async(db)=>{const own=await db.query('select id from faro.brands where id=$1',[b.brand_id]);if(own.rowCount!==1)return false;await db.query("insert into faro_private.oauth_attempts(auth_subject,provider,brand_id,state_hash,verifier,expires_at) values($1,'youtube',$2,$3,$4,now()+interval '10 minutes') on conflict(auth_subject,provider) do update set brand_id=excluded.brand_id,state_hash=excluded.state_hash,verifier=excluded.verifier,expires_at=excluded.expires_at,consumed_at=null",[subject,b.brand_id,hash(a.state),a.verifier]);return true});
  return saved?reply({data:{url:a.url}}):reply({error:'Marca no disponible'},403);
 }
 if(path==='/v1/youtube/finish'){
  if(Object.keys(b).length!==2||typeof b.state!=='string'||!(/^[A-Za-z0-9_-]{43}$/.test(b.state))||typeof b.code!=='string'||b.code.length<1||b.code.length>4096)return reply({error:'Autorización inválida'},400);
  const attempt=await tx(subject,async db=>(await db.query("update faro_private.oauth_attempts set consumed_at=now() where auth_subject=$1 and provider='youtube' and state_hash=$2 and consumed_at is null and expires_at>now() returning brand_id,verifier",[subject,hash(b.state)])).rows[0]||null);
  if(!attempt)return reply({error:'Autorización vencida o utilizada. Vuelve a conectar.'},409);
  let grant;try{grant=await exchange(c,b.code,attempt.verifier)}catch{return reply({error:'Google no confirmó el canal o los permisos. Vuelve a conectar.'},409)}
  const saved=await tx(subject,async(db,account)=>{
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,1))',[account]);
   const w=(await db.query('select w.id,p.max_connections from faro.brands b join faro.workspaces w on w.id=b.workspace_id join faro.plans p on p.code=w.plan_code where b.id=$1',[attempt.brand_id])).rows[0];if(!w)return null;
   const existing=(await db.query("select id,status from faro.connections where brand_id=$1 and provider='youtube' and external_account_id=$2",[attempt.brand_id,grant.channel.id])).rows[0];
   if(!existing||existing.status!=='connected'){const n=(await db.query("select count(*)::int as count from faro.connections c join faro.brands b on b.id=c.brand_id where b.workspace_id=$1 and c.status='connected'",[w.id])).rows[0].count;if(n>=w.max_connections)return {quota:true}}
   const row=(await db.query("insert into faro.connections(brand_id,provider,external_account_id,display_name,status) values($1,'youtube',$2,$3,'connected') on conflict(brand_id,provider,external_account_id) do update set display_name=excluded.display_name,status='connected',updated_at=now() returning id,display_name,status",[attempt.brand_id,grant.channel.id,grant.channel.title])).rows[0];
   await db.query("insert into faro_private.social_credentials(connection_id,ciphertext) values($1,$2) on conflict(connection_id) do update set ciphertext=excluded.ciphertext,updated_at=now()",[row.id,seal(c.key,row.id,grant.credentials)]);return row;
  });
  return !saved?reply({error:'Marca no disponible'},403):saved.quota?reply({error:'Cupo de conexiones agotado'},409):reply({data:saved},201);
 }
 return reply({error:'Ruta inválida'},404)
 }
}
