// Transport only. Never invoked by the running app. Explicit consent and fresh account validation required.
export const success=id=>({outcome:'success',external_post_id:id});
export const unknown=()=>({outcome:'unknown'});
export const permanent=()=>({outcome:'permanent'});
export const safeRetry=()=>({outcome:'safe_retry'});
export const tokenOk=x=>typeof x==='string'&&x.length>0&&x.length<=8192&&!/[\r\n]/.test(x);
export const bytesOk=(b,max)=>b instanceof Uint8Array&&b.byteLength>0&&b.byteLength<=max;
export const textOk=(s,max)=>typeof s==='string'&&s.length<=max;
export async function checkedFetch(fetcher,url,init,ms=15000){return fetcher(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(ms)})}
export async function responseId(r,pattern,field='id'){if(!r.ok)return unknown();try{const body=await r.json();return typeof body[field]==='string'&&pattern.test(body[field])?success(body[field]):unknown()}catch{return unknown()}}
