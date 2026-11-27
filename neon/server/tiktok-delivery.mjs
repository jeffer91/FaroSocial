import {checkedFetch,tokenOk,textOk,permanent,unknown,safeRetry} from './delivery-common.mjs';
import {pending,confirmed,trustedMedia} from './delivery-stages.mjs';
const root='https://open.tiktokapis.com/v2/';
const reference=x=>typeof x==='string'&&/^[A-Za-z0-9_.~:-]{1,64}$/.test(x);
const privacyLevels=['SELF_ONLY','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','PUBLIC_TO_EVERYONE'];
async function post(path,access,body,fetcher){const r=await checkedFetch(fetcher,root+path,{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(body)});if(!r.ok)throw Error('Provider rejected');const j=await r.json();if(j.error?.code!=='ok'||!j.data)throw Error('Provider rejected');return j.data}
export async function tiktokCreator(access,fetcher=fetch){
 if(!tokenOk(access))throw Error('Invalid access');const d=await post('post/publish/creator_info/query/',access,{},fetcher);
 if(typeof d.creator_username!=='string'||!d.creator_username||!Array.isArray(d.privacy_level_options)||!d.privacy_level_options.every(x=>privacyLevels.includes(x))||!Number.isFinite(d.max_video_post_duration_sec)||d.max_video_post_duration_sec<=0||!['comment_disabled','duet_disabled','stitch_disabled'].every(k=>typeof d[k]==='boolean'))throw Error('Invalid creator data');
 return {username:d.creator_username,privacy:d.privacy_level_options,maxDuration:d.max_video_post_duration_sec,commentDisabled:d.comment_disabled,duetDisabled:d.duet_disabled,stitchDisabled:d.stitch_disabled};
}
export async function tiktokStart(x,fetcher=fetch){
 // Cloud-hosted content uses PULL_FROM_URL, never FILE_UPLOAD. No default privacy.
 if(x.consent!==true||!tokenOk(x.access)||!trustedMedia(x.mediaUrl,x.verifiedOrigin)||x.mime!=='video/mp4'||!textOk(x.caption,2200)||!Number.isFinite(x.durationSec)||x.durationSec<=0||!privacyLevels.includes(x.privacy)||(!x.audited&&x.privacy!=='SELF_ONLY')||!['disableComment','disableDuet','disableStitch','brandContent','brandOrganic','aiGenerated'].every(k=>typeof x[k]==='boolean')||x.brandContent&&x.privacy==='SELF_ONLY'||typeof x.openId!=='string'||!x.openId||typeof x.creatorUsername!=='string'||!x.creatorUsername)return permanent();
 let creator;
 try{const r=await checkedFetch(fetcher,root+'user/info/?fields=open_id',{headers:{Authorization:'Bearer '+x.access}});if(!r.ok)return safeRetry();const j=await r.json();if(j.error?.code!=='ok'||j.data?.user?.open_id!==x.openId)return permanent();creator=await tiktokCreator(x.access,fetcher)}catch{return safeRetry()}
 if(creator.username!==x.creatorUsername||!creator.privacy.includes(x.privacy)||x.durationSec>creator.maxDuration||creator.commentDisabled&&!x.disableComment||creator.duetDisabled&&!x.disableDuet||creator.stitchDisabled&&!x.disableStitch)return permanent();
 try{const result=await post('post/publish/video/init/',x.access,{post_info:{title:x.caption,privacy_level:x.privacy,disable_comment:x.disableComment,disable_duet:x.disableDuet,disable_stitch:x.disableStitch,brand_content_toggle:x.brandContent,brand_organic_toggle:x.brandOrganic,is_aigc:x.aiGenerated},source_info:{source:'PULL_FROM_URL',video_url:x.mediaUrl}},fetcher);return reference(result.publish_id)?pending('tiktok',result.publish_id,'processing'):unknown()}catch{return unknown()}
}
export async function tiktokStatus({access,publishId},fetcher=fetch){
 if(!tokenOk(access)||!reference(publishId))return permanent();
 try{const d=await post('post/publish/status/fetch/',access,{publish_id:publishId},fetcher);
 if(d.status==='PUBLISH_COMPLETE'){
 // Public IDs may be unavailable; JSON numeric int64 can lose precision. Never fabricate IDs.
 const ids=Array.isArray(d.publicaly_available_post_id)?d.publicaly_available_post_id:[];
 const id=ids.length===1&&(typeof ids[0]==='string'&&/^\d+$/.test(ids[0])||Number.isSafeInteger(ids[0])&&ids[0]>0)?String(ids[0]):null;
 return confirmed('tiktok',publishId,id)
 }
 if(d.status==='FAILED')return {outcome:'permanent',reference:publishId};
 if(['PROCESSING_UPLOAD','PROCESSING_DOWNLOAD'].includes(d.status))return pending('tiktok',publishId,'processing');
 return {outcome:'unknown',reference:publishId}
 }catch{return pending('tiktok',publishId,'poll_error')}
}
