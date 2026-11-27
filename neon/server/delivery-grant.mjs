import {createHmac,timingSafeEqual} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sign=(key,body)=>createHmac('sha256',key).update('faro:delivery-media:v1:'+body).digest('base64url');
export function issueGrant({key,origin,jobId,mediaId,provider,ttl=900,now=Date.now()}){
 if(!Buffer.isBuffer(key)||key.length!==32||!uuid.test(jobId)||!uuid.test(mediaId)||!['instagram','tiktok'].includes(provider)||!Number.isInteger(ttl)||ttl<60||ttl>3600||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('Invalid grant');
 const body=Buffer.from(JSON.stringify({j:jobId,m:mediaId,p:provider,exp:Math.floor(now/1000)+ttl})).toString('base64url');
 return origin+'/delivery-media/'+mediaId+'?grant='+body+'.'+sign(key,body)
}
export function verifyGrant({key,token,mediaId,now=Date.now()}){
 try{if(!Buffer.isBuffer(key)||key.length!==32||typeof token!=='string'||token.length>1024||!uuid.test(mediaId))return null;
 const parts=token.split('.');if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))return null;
 const [body,tag]=parts,a=Buffer.from(tag),b=Buffer.from(sign(key,body));if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 const x=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(!uuid.test(x.j)||x.m!==mediaId||!['instagram','tiktok'].includes(x.p)||!Number.isSafeInteger(x.exp)||x.exp<=Math.floor(now/1000)||x.exp>Math.floor(now/1000)+3600)return null;return x
 }catch{return null}
}
// No HTTP route yet. Verification must ALSO check DB lease, job/media association,
// active account, grant revocation and object metadata before serving bytes.
