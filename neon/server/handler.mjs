import {validateWrite,readJson} from './write-validation.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export function createHandler({authenticate,read,write=null,media=null,social=null,queue=null,reports=null,allowedOrigins=[]}){
 const origins=new Set(allowedOrigins);
 return {async fetch(req){
  const origin=req.headers.get('origin');
  if(origin&&!origins.has(origin))return json({error:'Origen no autorizado'},403);
  const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const reply=(data,status=200)=>json(data,status,cors);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization','Cache-Control':'no-store'}});
  const url=new URL(req.url);
  const socialRoute=Boolean(social)&&((req.method==='GET'&&url.pathname==='/v1/social-status')||(req.method==='POST'&&['/v1/youtube/start','/v1/youtube/finish','/v1/tiktok/start','/v1/tiktok/finish','/v1/facebook/start','/v1/facebook/finish','/v1/facebook/select','/v1/instagram/start','/v1/instagram/finish','/v1/instagram/select'].includes(url.pathname)));
  const reportRoute=Boolean(reports)&&req.method==='GET'&&url.pathname==='/v1/reports';
  const queueRoute=Boolean(queue)&&((['GET','POST'].includes(req.method)&&url.pathname==='/v1/queue')||(req.method==='POST'&&url.pathname==='/v1/queue/cancel'));
  const mediaRoute=Boolean(media)&&url.pathname==='/v1/media-file'&&['GET','POST'].includes(req.method);
  const mutation=Boolean(write)&&((req.method==='POST'&&['/v1/access-request','/v1/workspaces','/v1/brands','/v1/drafts'].includes(url.pathname))||(req.method==='PATCH'&&url.pathname==='/v1/drafts'));
  if(req.method!=='GET'&&!mutation&&!mediaRoute&&!socialRoute&&!queueRoute)return reply({error:'Método no permitido'},405);
  if(url.pathname==='/health')return reply({ok:true,mode:write?'development-beta':'development-readonly'});
  const routes=['/v1/me','/v1/workspaces','/v1/brands','/v1/drafts','/v1/media','/v1/connections'];
  if(!mutation&&!mediaRoute&&!socialRoute&&!queueRoute&&!reportRoute&&!routes.includes(url.pathname))return reply({error:'No encontrado'},404);
  const m=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.get('authorization')||'');
  if(!m||m[1].length>8192)return reply({error:'Autenticación requerida'},401);
  let subject;try{subject=await authenticate(m[1]);if(typeof subject!=='string'||!UUID.test(subject))throw Error()}catch{return reply({error:'Sesión no válida'},401)}
  if(reportRoute){try{return await reports(subject,req)}catch{return reply({error:'Reporte no disponible'},503)}}
  if(queueRoute){try{return await queue(subject,req)}catch{return reply({error:'Cola no disponible'},503)}}
  if(socialRoute){if(url.search)return reply({error:'Parámetros no permitidos'},400);try{return await social(subject,req)}catch{return reply({error:'Conexión no disponible'},503)}}
  if(mediaRoute){try{return await media(subject,req)}catch{return reply({error:'Archivo pendiente o servicio no disponible'},503)}}
  if(mutation){if(url.search)return reply({error:'Parámetros no permitidos'},400);let b;try{b=validateWrite(url.pathname,await readJson(req))}catch{return reply({error:'Datos inválidos'},400)}try{const r=await write(subject,url.pathname,b,req.method);return reply(r.error?{error:r.error}:{data:r.data},r.status)}catch{return reply({error:'Servicio no disponible'},503)}}
  const keys=[...url.searchParams.keys()];let id=null;
  if(url.pathname==='/v1/brands'||url.pathname==='/v1/drafts'||url.pathname==='/v1/media'||url.pathname==='/v1/connections'){
   const key=url.pathname==='/v1/brands'?'workspace':'brand';
   if(keys.length!==1||keys[0]!==key||!UUID.test(url.searchParams.get(key)||''))return reply({error:'Identificador inválido'},400);
   id=url.searchParams.get(key);
  }else if(keys.length)return reply({error:'Parámetros no permitidos'},400);
  try{const data=await read(subject,url.pathname,id);return data===null?reply({error:'Cuenta no habilitada'},403):reply({data})}catch{return reply({error:'Servicio no disponible'},503)}
 }};
}
