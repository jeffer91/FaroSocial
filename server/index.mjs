import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {equal,random,stateStore,vault as createVault} from './security.mjs';
import {connector} from './youtube.mjs';
const origin='http://localhost:8787', password=process.env.FARO_PASSWORD||'', key=process.env.FARO_ENCRYPTION_KEY||'';
if(password.length<16||!/^[0-9a-f]{64}$/i.test(key))throw Error('Configura FARO_PASSWORD (mínimo 16 caracteres) y FARO_ENCRYPTION_KEY (64 hex) en .env');
const vault=createVault(fileURLToPath(new URL('../.data/',import.meta.url)),Buffer.from(key,'hex'));
const yt=connector({id:process.env.GOOGLE_CLIENT_ID,secret:process.env.GOOGLE_CLIENT_SECRET,redirect:origin+'/oauth/youtube/callback',vault});
const states=stateStore();let busy=false;
const staticFiles={'/':['../index.html','text/html; charset=utf-8'],'/index.html':['../index.html','text/html; charset=utf-8'],'/assets/style.css':['../assets/style.css','text/css; charset=utf-8'],'/assets/app.js':['../assets/app.js','text/javascript; charset=utf-8']};
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
function redirect(res,to,cookie){res.writeHead(303,{Location:to,...(cookie?{'Set-Cookie':cookie}:{})});res.end()}
function session(req){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('faro_session='))?.slice(13)||''}
function authenticated(req){const h=req.headers.authorization||'';if(!h.startsWith('Basic '))return false;return equal(Buffer.from(h.slice(6),'base64').toString(),'admin:'+password)}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{
 if(req.headers.host!=='localhost:8787')return json(res,403,{error:'Host no autorizado'});
 if(!authenticated(req)){res.setHeader('WWW-Authenticate','Basic realm="FaroSocial"');return json(res,401,{error:'Autenticación local requerida'})}
 if(req.method!=='GET'&&req.headers.origin!==origin)return json(res,403,{error:'Origen no autorizado'});
 const u=new URL(req.url,origin),p=u.pathname;
 if(req.method==='GET'&&staticFiles[p]){const [path,type]=staticFiles[p];res.writeHead(200,{'Content-Type':type});return res.end(await readFile(new URL(path,import.meta.url)))}
 if(req.method==='GET'&&p==='/api/status'){const t=await vault.read();return json(res,200,{configured:yt.configured,connected:Boolean(t),channel:t?.channel?.title||''})}
 if(req.method==='GET'&&p==='/oauth/youtube/start'){if(!yt.configured||busy||await vault.read())return redirect(res,'/?oauth=error');if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Origen no autorizado'});const s=random(),state=states.create(s);return redirect(res,yt.authURL(state),'faro_session='+s+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=600')}
 if(req.method==='GET'&&p==='/oauth/youtube/callback'){const s=states.take(u.searchParams.get('state'),session(req));if(!s||!u.searchParams.get('code')||u.searchParams.has('error')||busy)return redirect(res,'/?oauth=error');busy=true;try{if(await vault.read())return redirect(res,'/?oauth=error');await yt.connect(u.searchParams.get('code'),s.verifier);return redirect(res,'/?oauth=ok')}catch{return redirect(res,'/?oauth=error')}finally{busy=false}}
 if(req.method==='POST'&&p==='/api/youtube/disconnect'){if(busy)return json(res,409,{error:'Operación en curso'});busy=true;try{await yt.disconnect();return json(res,200,{ok:true})}finally{busy=false}}
 if(req.method==='POST'&&p==='/api/youtube/upload'){if(busy)return json(res,409,{error:'Operación en curso'});const length=Number(req.headers['content-length']),title=(u.searchParams.get('title')||'').trim(),description=u.searchParams.get('description')||'',kids=u.searchParams.get('kids');if(!yt.configured||u.searchParams.get('confirm')!=='private'||!title||title.length>100||description.length>4000||!['true','false'].includes(kids)||req.headers['content-type']!=='video/mp4'||!Number.isSafeInteger(length)||length<1||length>104857600)return json(res,400,{error:'Datos de video no válidos'});busy=true;try{return json(res,200,await yt.upload({title,description,kids:kids==='true',length,stream:req}))}finally{busy=false}}
 return json(res,404,{error:'Ruta no disponible'});
 }catch(e){console.error('Operación fallida:',e.name);if(!res.headersSent)json(res,502,{error:'Operación no confirmada. Revisa la configuración y los permisos.'});else res.destroy()}
});
server.requestTimeout=330000;server.listen(8787,'localhost',()=>console.log('FaroSocial: '+origin));
