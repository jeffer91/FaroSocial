import handler from './index.cjs';
import {readFile} from 'node:fs/promises';
const api=handler.default??handler;
const authOrigin="https://ep-noisy-cherry-bb524mc3.neonauth.c-15.us-east-1.aws.neon.tech";
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self' "+authOrigin+"; frame-src "+authOrigin+"; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
export default {async fetch(req){const path=new URL(req.url).pathname;
 if(req.method==='GET'&&(path==='/preview'||path==='/preview.js')){
  const file=path==='/preview'?'preview.html':'preview.js';
  const body=await readFile(new URL(file,import.meta.url));
  return new Response(body,{headers:{...headers,'Content-Type':path==='/preview'?'text/html; charset=utf-8':'text/javascript; charset=utf-8'}});
 }
 return api.fetch(req);
}};
