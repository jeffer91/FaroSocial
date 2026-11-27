export function validateConfig(config){
 try{
 const url=new URL(config.url);
 if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)return null;
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey))return null;
 return {url:url.origin,key:config.publishableKey};
 }catch{return null}
}
export function cloudClient(config,fetcher=fetch){
 const c=validateConfig(config);
 if(!c)throw Error('Configuración pública pendiente');
 let session=null;
 async function request(path,{method='GET',body,authenticated=true,headers={}}={}){
  if(authenticated&&(!session||Date.now()>=session.expiry)){session=null;throw Error('Sesión no disponible. Inicia sesión de nuevo.')}
  const res=await fetcher(c.url+path,{method,redirect:'error',cache:'no-store',credentials:'omit',headers:{apikey:c.key,...(authenticated?{Authorization:'Bearer '+session.token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!res.ok){if(authenticated&&res.status===401)session=null;throw Error(res.status===401?'Acceso no autorizado.':res.status===429?'Demasiadas solicitudes. Intenta más tarde.':'No se pudo completar la solicitud.')}
  return res.status===204?null:res.json();
 }
 return {
  async signIn(email,password){session=null;const v=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},authenticated:false});if(!v.access_token||!v.user?.id||!Number.isFinite(v.expires_in)||v.expires_in<=0)throw Error('Respuesta de autenticación inválida');session={token:v.access_token,user:v.user.id,email:v.user.email||email,expiry:Date.now()+v.expires_in*1000};return {id:session.user,email:session.email}},
  async signOut(){try{if(session&&Date.now()<session.expiry)await request('/auth/v1/logout?scope=local',{method:'POST'})}finally{session=null}},
  isSignedIn(){return Boolean(session&&Date.now()<session.expiry)},
  async brands(){return request('/rest/v1/faro_brands?select=id,name,created_at&order=created_at.desc')},
  async createBrand(name){const n=name.trim();if(n.length<1||n.length>80)throw Error('Nombre inválido');return request('/rest/v1/faro_brands',{method:'POST',body:{name:n},headers:{Prefer:'return=minimal'}})}
 };
}
