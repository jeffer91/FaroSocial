import {randomUUID} from 'node:crypto';
import {hash,seal,open} from './youtube-oauth.mjs';
import {metaConfig,metaAuthorize,discover,providers} from './meta-oauth.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function metaRoute({tx,env,subject,path,b}){
 const [, ,p,action]=path.split('/');if(!providers.includes(p))return reply({error:'Proveedor inválido'},404);
 const c=metaConfig(env);if(!c)return reply({error:'Meta pendiente de configuración comercial'},503);
 if(action==='start'){
  if(Object.keys(b).length!==1||typeof b.brand_id!=='string'||!UUID.test(b.brand_id))return reply({error:'Marca inválida'},400);
  const a=metaAuthorize(c,p);
  const ok=await tx(subject,async db=>{if(!(await db.query('select id from faro.brands where id=$1',[b.brand_id])).rowCount)return false;await db.query("insert into faro_private.oauth_attempts(auth_subject,provider,brand_id,state_hash,verifier,expires_at) values($1,$2,$3,$4,$5,now()+interval '10 minutes') on conflict(auth_subject,provider) do update set brand_id=excluded.brand_id,state_hash=excluded.state_hash,verifier=excluded.verifier,expires_at=excluded.expires_at,consumed_at=null",[subject,p,b.brand_id,hash(a.state),a.verifier]);return true});
  return ok?reply({data:{url:a.url}}):reply({error:'Marca no disponible'},403)
 }
 if(action==='finish'){
  if(Object.keys(b).length!==2||typeof b.state!=='string'||!(/^[A-Za-z0-9_-]{43}$/.test(b.state))||typeof b.code!=='string'||!b.code||b.code.length>4096)return reply({error:'Autorización inválida'},400);
  const attempt=await tx(subject,async db=>(await db.query("update faro_private.oauth_attempts set consumed_at=now() where auth_subject=$1 and provider=$2 and state_hash=$3 and consumed_at is null and expires_at>now() returning brand_id",[subject,p,hash(b.state)])).rows[0]||null);
  if(!attempt)return reply({error:'Autorización vencida o utilizada'},409);
  let candidates;try{candidates=await discover(c,p,b.code)}catch{return reply({error:'Meta no confirmó los activos o permisos'},409)}
  if(!candidates.length)return reply({error:p==='instagram'?'No hay cuentas profesionales vinculadas a páginas autorizadas':'No hay páginas con permiso para crear contenido'},409);
  const choice=randomUUID();
  const saved=await tx(subject,async db=>{await db.query("insert into faro_private.meta_choices(id,auth_subject,provider,brand_id,ciphertext,expires_at) values($1,$2,$3,$4,$5,now()+interval '10 minutes') on conflict(auth_subject,provider) do update set id=excluded.id,brand_id=excluded.brand_id,ciphertext=excluded.ciphertext,expires_at=excluded.expires_at,consumed_at=null",[choice,subject,p,attempt.brand_id,seal(c.key,'meta:'+p+':'+choice,candidates)]);return true});
  return saved?reply({data:{choice,brand_id:attempt.brand_id,items:candidates.map(x=>({id:x.id,title:x.title}))}}):reply({error:'Cuenta no habilitada'},403)
 }
 if(action==='select'){
  if(Object.keys(b).length!==2||typeof b.choice!=='string'||!UUID.test(b.choice)||typeof b.target!=='string'||!/^\d{1,32}$/.test(b.target))return reply({error:'Selección inválida'},400);
  const saved=await tx(subject,async(db,account)=>{
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,1))',[account]);
   const row=(await db.query("select brand_id,ciphertext from faro_private.meta_choices where id=$1 and auth_subject=$2 and provider=$3 and consumed_at is null and expires_at>now() for update",[b.choice,subject,p])).rows[0];if(!row)return {invalid:true};
   const item=open(c.key,'meta:'+p+':'+b.choice,row.ciphertext).find(x=>x.id===b.target);if(!item)return {invalid:true};
   const w=(await db.query('select w.id,p.max_connections from faro.brands b join faro.workspaces w on w.id=b.workspace_id join faro.plans p on p.code=w.plan_code where b.id=$1',[row.brand_id])).rows[0];if(!w)return {invalid:true};
   const previous=(await db.query('select id,status from faro.connections where brand_id=$1 and provider=$2 and external_account_id=$3',[row.brand_id,p,item.id])).rows[0];
   if(!previous||previous.status!=='connected'){const n=(await db.query("select count(*)::int as count from faro.connections c join faro.brands b on b.id=c.brand_id where b.workspace_id=$1 and c.status='connected'",[w.id])).rows[0].count;if(n>=w.max_connections)return {quota:true}}
   const out=(await db.query("insert into faro.connections(brand_id,provider,external_account_id,display_name,status) values($1,$2,$3,$4,'connected') on conflict(brand_id,provider,external_account_id) do update set display_name=excluded.display_name,status='connected',updated_at=now() returning id,display_name,status",[row.brand_id,p,item.id,item.title])).rows[0];
   await db.query("insert into faro_private.social_credentials(connection_id,ciphertext) values($1,$2) on conflict(connection_id) do update set ciphertext=excluded.ciphertext,updated_at=now()",[out.id,seal(c.key,p+':'+out.id,item.credentials)]);
   await db.query("update faro_private.meta_choices set consumed_at=now(),ciphertext='' where id=$1",[b.choice]);return out;
  });
  return !saved?reply({error:'Cuenta no habilitada'},403):saved.invalid?reply({error:'Selección vencida o inválida'},409):saved.quota?reply({error:'Cupo de conexiones agotado'},409):reply({data:saved},201)
 }
 return reply({error:'Ruta inválida'},404)
}
