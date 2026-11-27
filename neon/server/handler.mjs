const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export function createHandler({authenticate,read,allowedOrigins=[]}){
 const origins=new Set(allowedOrigins);
 return {async fetch(req){
  const origin=req.headers.get('origin');
  if(origin&&!origins.has(origin))return json({error:'Origen no autorizado'},403);
  const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const reply=(data,status=200)=>json(data,status,cors);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization','Cache-Control':'no-store'}});
  const url=new URL(req.url);
  if(req.method!=='GET')return reply({error:'Método no permitido'},405);
  if(url.pathname==='/health')return reply({ok:true,mode:'development-readonly'});
  const routes=['/v1/me','/v1/workspaces','/v1/brands','/v1/drafts'];
  if(!routes.includes(url.pathname))return reply({error:'No encontrado'},404);
  const m=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.get('authorization')||'');
  if(!m||m[1].length>8192)return reply({error:'Autenticación requerida'},401);
  let subject;try{subject=await authenticate(m[1]);if(typeof subject!=='string'||!UUID.test(subject))throw Error()}catch{return reply({error:'Sesión no válida'},401)}
  const keys=[...url.searchParams.keys()];let id=null;
  if(url.pathname==='/v1/brands'||url.pathname==='/v1/drafts'){
   const key=url.pathname==='/v1/brands'?'workspace':'brand';
   if(keys.length!==1||keys[0]!==key||!UUID.test(url.searchParams.get(key)||''))return reply({error:'Identificador inválido'},400);
   id=url.searchParams.get(key);
  }else if(keys.length)return reply({error:'Parámetros no permitidos'},400);
  try{const data=await read(subject,url.pathname,id);return data===null?reply({error:'Cuenta no habilitada'},403):reply({data})}catch{return reply({error:'Servicio no disponible'},503)}
 }};
}
