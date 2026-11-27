import {createHmac} from 'node:crypto';
import {META_VERSION} from './meta-oauth.mjs';
import {checkedFetch,tokenOk,textOk,permanent,unknown,safeRetry,responseId} from './delivery-common.mjs';
import {pending,confirmed,trustedMedia,numericId} from './delivery-stages.mjs';
const base='https://graph.facebook.com/'+META_VERSION;
function auth(access,secret){return {headers:{Authorization:'Bearer '+access},proof:createHmac('sha256',secret).update(access).digest('hex')}}
function valid(x){return tokenOk(x.access)&&tokenOk(x.appSecret)&&numericId(x.pageId)&&numericId(x.accountId)&&x.consent===true}
async function identity(x,fetcher){const {headers,proof}=auth(x.access,x.appSecret);const r=await checkedFetch(fetcher,base+'/'+x.pageId+'?'+new URLSearchParams({fields:'id,instagram_business_account{id}',appsecret_proof:proof}),{headers});if(!r.ok)return null;const b=await r.json();return b.id===x.pageId&&b.instagram_business_account?.id===x.accountId}
export async function instagramStart(x,fetcher=fetch){
 if(!valid(x)||!trustedMedia(x.mediaUrl,x.verifiedOrigin)||!['image/jpeg','video/mp4'].includes(x.mime)||!textOk(x.caption,2200))return permanent();
 try{const same=await identity(x,fetcher);if(same===null)return safeRetry();if(!same)return permanent()}catch{return safeRetry()}
 const {headers,proof}=auth(x.access,x.appSecret),body=new URLSearchParams({caption:x.caption,appsecret_proof:proof,...(x.mime==='image/jpeg'?{image_url:x.mediaUrl}:{video_url:x.mediaUrl,media_type:'REELS'})});
 try{const r=await checkedFetch(fetcher,base+'/'+x.accountId+'/media',{method:'POST',headers,body});if(!r.ok)return unknown();const j=await r.json();return numericId(j.id)?pending('instagram',j.id,'container'):unknown()}catch{return unknown()}
}
export async function instagramStatus(x,fetcher=fetch){
 if(!valid(x)||!numericId(x.containerId))return permanent();
 const {headers,proof}=auth(x.access,x.appSecret);
 try{const r=await checkedFetch(fetcher,base+'/'+x.containerId+'?'+new URLSearchParams({fields:'id,status_code',appsecret_proof:proof}),{headers});if(!r.ok)return pending('instagram',x.containerId,'poll_error');const j=await r.json();if(j.id!==x.containerId)return unknown();
 if(j.status_code==='FINISHED')return pending('instagram',x.containerId,'ready');
 if(j.status_code==='IN_PROGRESS')return pending('instagram',x.containerId,'processing');
 if(j.status_code==='PUBLISHED')return confirmed('instagram',x.containerId);
 if(['ERROR','EXPIRED'].includes(j.status_code))return {outcome:'permanent',reference:x.containerId};
 return unknown()}catch{return pending('instagram',x.containerId,'poll_error')}
}
export async function instagramPublish(x,fetcher=fetch){
 // Caller must hold durable exclusive publication lease and have recorded intent.
 if(!valid(x)||!numericId(x.containerId)||x.publishIntentRecorded!==true)return permanent();
 try{const same=await identity(x,fetcher);if(same===null)return pending('instagram',x.containerId,'poll_error');if(!same)return permanent()}catch{return pending('instagram',x.containerId,'poll_error')}
 const state=await instagramStatus(x,fetcher);if(state.stage!=='ready')return state;
 const {headers,proof}=auth(x.access,x.appSecret);
 try{const r=await checkedFetch(fetcher,base+'/'+x.accountId+'/media_publish',{method:'POST',headers,body:new URLSearchParams({creation_id:x.containerId,appsecret_proof:proof})});const result=await responseId(r,/^\d{1,32}$/);return result.outcome==='success'?confirmed('instagram',x.containerId,result.external_post_id):{outcome:'unknown',reference:x.containerId}}catch{return {outcome:'unknown',reference:x.containerId}}
}
