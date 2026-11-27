import {S3Client,GetObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {verifyGrant} from './delivery-grant.mjs';
const fail=()=>new Response(null,{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createDeliveryStorage(env){
 const s3=new S3Client({forcePathStyle:true,region:env.AWS_REGION,endpoint:env.AWS_ENDPOINT_URL_S3,maxAttempts:1});
 const validate=m=>{if(!m||typeof m.path!=='string'||!(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/i.test(m.path))||!['image/jpeg','image/png','image/webp','video/mp4'].includes(m.mime)||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>30*1048576)throw Error('Invalid media')};
 async function head(m){validate(m);const r=await s3.send(new HeadObjectCommand({Bucket:'faro-media',Key:m.path}),{abortSignal:AbortSignal.timeout(15000)});if(r.ContentLength!==m.bytes||r.ContentType!==m.mime)throw Error('Object mismatch')}
 async function read(m,range=null){await head(m);const expected=range?range.end-range.start+1:m.bytes;const r=await s3.send(new GetObjectCommand({Bucket:'faro-media',Key:m.path,...(range?{Range:'bytes='+range.start+'-'+range.end}:{})}),{abortSignal:AbortSignal.timeout(20000)});if(r.ContentLength!==expected||r.ContentType!==m.mime||!r.Body||(range&&r.ContentRange!=='bytes '+range.start+'-'+range.end+'/'+m.bytes)){r.Body?.destroy?.();throw Error('Object mismatch')}const bytes=new Uint8Array(expected);let n=0;try{for await(const chunk of r.Body){if(n+chunk.byteLength>expected)throw Error('Length mismatch');bytes.set(chunk,n);n+=chunk.byteLength}}finally{r.Body.destroy?.()}if(n!==expected)throw Error('Length mismatch');return bytes}
 return {head,read}
}
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
