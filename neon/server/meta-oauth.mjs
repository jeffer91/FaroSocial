import {randomBytes,createHmac} from 'node:crypto';
export const META_VERSION='v26.0';
const base='https://graph.facebook.com/'+META_VERSION;
const origin='https://br-damp-scene-bbnr2g7d-farosocialapi.compute.c-15.us-east-1.aws.neon.tech';
export const providers=['facebook','instagram'];
export const scopes=p=>p==='facebook'?['pages_show_list','pages_read_engagement','pages_manage_posts']:p==='instagram'?['pages_show_list','pages_read_engagement','instagram_basic','instagram_content_publish']:(()=>{throw Error('Proveedor inválido')})();
export const callback=p=>origin+'/oauth/'+p+'/callback';
export function metaConfig(env){const id=env.FARO_META_APP_ID,secret=env.FARO_META_APP_SECRET,raw=env.FARO_TOKEN_KEY;if(!id||!secret||!/^\d+$/.test(id)||typeof raw!=='string'||!(/^[A-Za-z0-9+/]{43}=$/.test(raw)))return null;const key=Buffer.from(raw,'base64');return key.length===32?{id,secret,key}:null}
export function metaAuthorize(c,p){const state=randomBytes(32).toString('base64url');const verifier=randomBytes(48).toString('base64url');return {state,verifier,url:'https://www.facebook.com/'+META_VERSION+'/dialog/oauth?'+new URLSearchParams({client_id:c.id,redirect_uri:callback(p),response_type:'code',scope:scopes(p).join(','),state})}}
async function get(path,params,fetcher,access,c){const q=new URLSearchParams(params);if(access&&c)q.set('appsecret_proof',createHmac('sha256',c.secret).update(access).digest('hex'));const r=await fetcher(base+path+'?'+q,{headers:access?{Authorization:'Bearer '+access}:{},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Meta rechazó la solicitud');const x=await r.json();if(x.error)throw Error('Meta rechazó la solicitud');return x}
export async function discover(c,p,code,fetcher=fetch){
 const short=await get('/oauth/access_token',{client_id:c.id,client_secret:c.secret,redirect_uri:callback(p),code},fetcher);
 if(typeof short.access_token!=='string'||!short.access_token)throw Error('Sin token');
 const long=await get('/oauth/access_token',{grant_type:'fb_exchange_token',client_id:c.id,client_secret:c.secret,fb_exchange_token:short.access_token},fetcher);
 if(typeof long.access_token!=='string'||!long.access_token)throw Error('Sin token extendido');
 const permission=await get('/me/permissions',{},fetcher,long.access_token,c);const granted=new Set((permission.data||[]).filter(x=>x.status==='granted').map(x=>x.permission));if(!scopes(p).every(x=>granted.has(x)))throw Error('Permisos incompletos');
 const fields=p==='instagram'?'id,name,access_token,tasks,instagram_business_account{id,username}':'id,name,access_token,tasks';
 const found=[],seen=new Set();let after;
 for(let page=0;page<4;page++){
  const data=await get('/me/accounts',{fields,limit:'25',...(after?{after}:{})},fetcher,long.access_token,c);
  if(!Array.isArray(data.data))throw Error('Respuesta inválida');
  for(const row of data.data){
   if(!/^\d+$/.test(row.id)||typeof row.access_token!=='string'||!row.access_token||!Array.isArray(row.tasks)||!row.tasks.some(t=>['CREATE_CONTENT','MANAGE','PROFILE_PLUS_CREATE_CONTENT','PROFILE_PLUS_FULL_CONTROL'].includes(t)))continue;
   const ig=row.instagram_business_account;const target=p==='instagram'?ig?.id:row.id;
   const name=p==='instagram'?ig?.username:row.name;
   if(!/^\d+$/.test(target||'')||typeof name!=='string'||!name.trim()||seen.has(target))continue;
   seen.add(target);found.push({id:target,title:name.slice(0,180),credentials:{page_id:row.id,access_token:row.access_token,provider:p,scope:scopes(p),obtained_at:Date.now(),expires_at:null}})
  }
  if(!data.paging?.next)return found;
  const cursor=data.paging.cursors?.after;if(typeof cursor!=='string'||!cursor||cursor===after)throw Error('Paginación inválida');after=cursor;
 }
 throw Error('Demasiadas páginas; limita los activos autorizados');
}
