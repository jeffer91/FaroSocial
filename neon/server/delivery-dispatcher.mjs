import {youtubeDeliver,youtubeRefresh} from './youtube-delivery.mjs';
import {facebookDeliver} from './facebook-delivery.mjs';
import {instagramStart,instagramStatus,instagramPublish} from './instagram-delivery.mjs';
import {tiktokStart,tiktokStatus} from './tiktok-delivery.mjs';
import {tiktokRefresh} from './tiktok-oauth.mjs';
import {permanent,unknown,safeRetry} from './delivery-common.mjs';
// Dependencies must be supplied by a future job-scoped repository. No default external calls.
export function createDispatcher({loadContext,saveCredentials,loadBytes,issueMedia,fetcher=fetch,enabled=false}={}){
 return async job=>{
 if(!enabled||!job?.authorized_at||!job.lease_id||Date.parse(job.lease_expires_at)<=Date.now()||!job.payload?.consent||typeof loadContext!=='function')return permanent();
 const p=job.payload.provider,stage=job.delivery_stage;
 let context;try{context=await loadContext(job)}catch{return job.provider_reference?unknown():safeRetry()}
 if(!context||context.status!=='connected'||context.provider!==p||context.connectionId!==job.connection_id||context.brandId!==job.brand_id||context.accountEnabled!==true)return permanent();
 let credentials=context.credentials;
 if(!credentials)return permanent();
 if(['youtube','tiktok'].includes(p)&&(!Number.isFinite(credentials.expires_at)||credentials.expires_at<=Date.now()+60000)){
  if(typeof saveCredentials!=='function'||!context.config)return permanent();
  try{const next=await (p==='youtube'?youtubeRefresh:tiktokRefresh)(context.config,credentials,fetcher);
   if(await saveCredentials(job,context.version,next)!==true)return unknown();credentials=next;
  }catch{return unknown()} // rotation could have occurred; don't blindly refresh again
 }
 const opts=job.payload.options||{},caption=[job.payload.title,job.payload.description].filter(Boolean).join('\n\n');
 const args={access:credentials.access_token,appSecret:context.config?.secret,pageId:credentials.page_id,accountId:context.externalId,consent:true,caption};
 if(job.provider_reference){
 if(p==='instagram')return stage==='publish_intent'?instagramPublish({...args,containerId:job.provider_reference,publishIntentRecorded:true},fetcher):instagramStatus({...args,containerId:job.provider_reference},fetcher);
 if(p==='tiktok')return tiktokStatus({access:args.access,publishId:job.provider_reference},fetcher);
 return unknown();
 }
 if(stage!=='new')return unknown();
 if(p==='youtube'||p==='facebook'){
  let bytes=null;if(job.payload.media_id){if(typeof loadBytes!=='function')return permanent();try{bytes=await loadBytes(job)}catch{return safeRetry()}}
  const input={...args,title:job.payload.title,description:job.payload.description,mime:job.payload.mime_type,bytes};
  return p==='youtube'?youtubeDeliver({...input,channelId:context.externalId,privacy:opts.privacy,kids:opts.kids},fetcher):facebookDeliver({...input,pageId:context.externalId},fetcher);
 }
 if(!['instagram','tiktok'].includes(p)||typeof issueMedia!=='function')return permanent();
 let media;try{media=await issueMedia(job)}catch{return safeRetry()}
 const input={...args,mediaUrl:media.url,verifiedOrigin:media.origin,mime:job.payload.mime_type};
 if(p==='instagram')return instagramStart(input,fetcher);
 return tiktokStart({...input,openId:context.externalId,creatorUsername:opts.creatorUsername,privacy:opts.privacy,audited:context.audited===true,durationSec:media.durationSec,disableComment:opts.disableComment,disableDuet:opts.disableDuet,disableStitch:opts.disableStitch,brandContent:opts.brandContent,brandOrganic:opts.brandOrganic,aiGenerated:opts.aiGenerated},fetcher)
 }
}
