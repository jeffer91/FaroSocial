import {createHmac} from 'node:crypto';
import {META_VERSION} from './meta-oauth.mjs';
import {unknown,permanent,safeRetry,tokenOk,bytesOk,textOk,checkedFetch,responseId} from './delivery-common.mjs';
// Page text or single JPEG/PNG. No personal profile, no unsupported video fallback.
export async function facebookDeliver({access,appSecret,pageId,title,description,bytes=null,mime=null,consent},fetcher=fetch){
 if(consent!==true||!tokenOk(access)||!tokenOk(appSecret)||!/^\d{1,32}$/.test(pageId)||!textOk(title,100)||!title.trim()||!textOk(description,2200)||!(bytes===null&&mime===null||['image/jpeg','image/png'].includes(mime)&&bytesOk(bytes,10*1048576)))return permanent();
 const base='https://graph.facebook.com/'+META_VERSION,proof=createHmac('sha256',appSecret).update(access).digest('hex'),headers={Authorization:'Bearer '+access};
 try{const r=await checkedFetch(fetcher,base+'/me?'+new URLSearchParams({fields:'id',appsecret_proof:proof}),{headers});if(!r.ok)return r.status===429||r.status>=500?safeRetry():permanent();if((await r.json()).id!==pageId)return permanent()}catch{return safeRetry()}
 const message=[title,description].filter(Boolean).join('\n\n');
 try{
 let body,path;
 if(bytes){body=new FormData();body.set('source',new Blob([bytes],{type:mime}),mime==='image/jpeg'?'photo.jpg':'photo.png');body.set('caption',message);body.set('published','true');body.set('appsecret_proof',proof);path='/photos'}
 else{body=new URLSearchParams({message,published:'true',appsecret_proof:proof});path='/feed'}
 const r=await checkedFetch(fetcher,base+'/'+pageId+path,{method:'POST',headers,body},60000);
 return responseId(r,/^\d+(?:_\d+)?$/);
 }catch{return unknown()}
}
