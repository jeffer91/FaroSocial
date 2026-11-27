export function validateConfig(config){
 try{
 const url=new URL(config.url);
 if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)return null;
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey))return null;
 return {url:url.origin,key:config.publishableKey};
 }catch{return null}
}
export const CALLBACK='https://jeffer91.github.io/FaroSocial/';
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function beginGoogle(config,storage,now=Date.now()){
 const c=validateConfig(config);if(!c)throw Error('Configuración pendiente');
 const verifier=b64url(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 storage.setItem('farosocial.pkce.v1',JSON.stringify({verifier,expires:now+300000}));
 const params=new URLSearchParams({provider:'google',redirect_to:CALLBACK,code_challenge:challenge,code_challenge_method:'s256',scopes:'openid email profile',prompt:'select_account'});
 return c.url+'/auth/v1/authorize?'+params;
}
export function takeVerifier(storage,now=Date.now()){
 const raw=storage.getItem('farosocial.pkce.v1');storage.removeItem('farosocial.pkce.v1');
 try{const v=JSON.parse(raw);if(!v||! /^[A-Za-z0-9_-]{43}$/.test(v.verifier)||!Number.isFinite(v.expires)||now>=v.expires)return null;return v.verifier}catch{return null}
}
function requireId(id){if(typeof id!=='string'||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))throw Error('Identificador inválido');return id}
export function cloudClient(config,fetcher=fetch){
 const c=validateConfig(config);
 if(!c)throw Error('Configuración pública pendiente');
 let session=null;
 async function request(path,{method='GET',body,authenticated=true,headers={}}={}){
  if(authenticated&&(!session||Date.now()>=session.expiry)){session=null;throw Error('Sesión no disponible. Inicia sesión de nuevo.')}
  const res=await fetcher(c.url+path,{method,redirect:'error',cache:'no-store',credentials:'omit',headers:{apikey:c.key,...(authenticated?{Authorization:'Bearer '+session.token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!res.ok){if(authenticated&&res.status===401)session=null;throw Error(res.status===401?'Acceso no autorizado.':res.status===429?'Demasiadas solicitudes. Intenta más tarde.':'No se pudo completar la solicitud.')}
  if(res.status===204)return null;
  const raw=await res.text();return raw?JSON.parse(raw):null;
 }
 return {
  async exchange(code,verifier){
   session=null;if(!code||code.length>2048||! /^[A-Za-z0-9_-]{43}$/.test(verifier))throw Error('Autorización inválida');
   const v=await request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:verifier},authenticated:false});
   if(!v?.access_token||!v.user?.id||!Number.isFinite(v.expires_in)||v.expires_in<=0)throw Error('Respuesta de autenticación inválida');
   session={token:v.access_token,user:v.user.id,expiry:Date.now()+v.expires_in*1000};
   try{const user=await request('/auth/v1/user');if(user.id!==session.user||user.app_metadata?.farosocial_access!==true)throw Error('Cuenta no autorizada');return {id:user.id,email:user.email||'',name:user.user_metadata?.full_name||user.user_metadata?.name||''}}
   catch(e){try{await request('/auth/v1/logout?scope=local',{method:'POST'})}catch{}session=null;throw e}
  },
  async signOut(){try{if(session&&Date.now()<session.expiry)await request('/auth/v1/logout?scope=local',{method:'POST'})}finally{session=null}},
  isSignedIn(){return Boolean(session&&Date.now()<session.expiry)},
  async workspaces(){return request('/rest/v1/faro_workspaces?select=id,name,plan_code,faro_plans(name,max_brands,max_connections,max_monthly_posts)')},
  async createWorkspace(name){const n=name.trim();if(n.length<1||n.length>80)throw Error('Nombre inválido');return request('/rest/v1/faro_workspaces',{method:'POST',body:{name:n},headers:{Prefer:'return=minimal'}})},
  async brands(workspaceId){return request('/rest/v1/faro_brands?'+new URLSearchParams({select:'id,name,slot,created_at',workspace_id:'eq.'+requireId(workspaceId),order:'slot.asc'}))},
  async createBrand(workspaceId,name,slot){const n=name.trim();if(n.length<1||n.length>80||!Number.isInteger(slot)||slot<1||slot>100)throw Error('Datos inválidos');return request('/rest/v1/faro_brands',{method:'POST',body:{workspace_id:requireId(workspaceId),name:n,slot},headers:{Prefer:'return=minimal'}})}
 };
}
