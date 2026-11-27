import {verifyGrant} from './delivery-grant.mjs';
const fail=()=>new Response(null,{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function parseRange(value,size){if(value===null)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(value);if(!m||!m[1]&&!m[2])throw Error('Range invalid');let start,end;if(!m[1]){const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)throw Error('Range invalid');start=Math.max(0,size-n);end=size-1}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw Error('Range invalid');return {start,end}}
export function createDeliveryMedia({resolveGrant,storage,key,enabled=false}){
 return async req=>{
 if(!enabled||!['GET','HEAD'].includes(req.method))return fail();
 try{const url=new URL(req.url),id=/^\/delivery-media\/([0-9a-f-]{36})$/i.exec(url.pathname)?.[1];if(!id||[...url.searchParams.keys()].length!==1)return fail();
 const g=verifyGrant({key,token:url.searchParams.get('grant'),mediaId:id});if(!g)return fail();
 const m=await resolveGrant(g);if(!m)return fail();
 const headers={'Content-Type':m.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Accept-Ranges':'bytes','Referrer-Policy':'no-referrer'};
 let range;try{range=parseRange(req.headers.get('range'),m.bytes)}catch{return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+m.bytes}})}
 const n=range?range.end-range.start+1:m.bytes;headers['Content-Length']=String(n);if(range)headers['Content-Range']='bytes '+range.start+'-'+range.end+'/'+m.bytes;
 if(req.method==='HEAD'){await storage.head(m);return new Response(null,{status:range?206:200,headers})}
 const bytes=await storage.read(m,range);if(bytes.byteLength!==n)return fail();return new Response(bytes,{status:range?206:200,headers})
 }catch{return fail()}
 }
}
