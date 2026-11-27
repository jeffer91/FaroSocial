import {SCOPE} from './youtube-oauth.mjs';
import {success,unknown,permanent,safeRetry,tokenOk,bytesOk,textOk,checkedFetch,responseId} from './delivery-common.mjs';
export async function youtubeRefresh(c,old,fetcher=fetch){
 if(!tokenOk(old?.refresh_token))throw Error('Refresh token unavailable');
 const r=await checkedFetch(fetcher,'https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:c.id,client_secret:c.secret,grant_type:'refresh_token',refresh_token:old.refresh_token})});
 if(!r.ok)throw Error('Refresh failed');const t=await r.json();if(!tokenOk(t.access_token)||!Number.isSafeInteger(t.expires_in)||t.expires_in<=0||t.scope&&!SCOPE.every(s=>t.scope.split(' ').includes(s)))throw Error('Invalid refresh response');
 return {...old,access_token:t.access_token,refresh_token:tokenOk(t.refresh_token)?t.refresh_token:old.refresh_token,expires_at:Date.now()+t.expires_in*1000};
}
export async function youtubeDeliver({access,channelId,title,description,bytes,mime,privacy,kids,consent},fetcher=fetch){
 if(consent!==true||privacy!=='private'||typeof kids!=='boolean'||!tokenOk(access)||!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)||!textOk(title,100)||!title.trim()||!textOk(description,2200)||mime!=='video/mp4'||!bytesOk(bytes,30*1048576))return permanent();
 const headers={Authorization:'Bearer '+access};
 // Read-only preflight. Any failure here is safe: no write was attempted.
 try{const r=await checkedFetch(fetcher,'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&maxResults=2',{headers});if(!r.ok)return r.status===429||r.status>=500?safeRetry():permanent();const j=await r.json();if(j.nextPageToken||j.items?.length!==1||j.items[0].id!==channelId)return permanent()}catch{return safeRetry()}
 let r;try{r=await checkedFetch(fetcher,'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Length':String(bytes.byteLength),'X-Upload-Content-Type':mime},body:JSON.stringify({snippet:{title,description,categoryId:'22'},status:{privacyStatus:'private',selfDeclaredMadeForKids:kids}})})}catch{return unknown()}
 if(!r.ok)return unknown();let target;try{target=new URL(r.headers.get('location')||'');if(target.protocol!=='https:'||!['www.googleapis.com','youtube.googleapis.com'].includes(target.hostname)||target.username||target.password||target.port||target.pathname!=='/upload/youtube/v3/videos'||!target.searchParams.get('upload_id'))return unknown()}catch{return unknown()}
 try{const done=await checkedFetch(fetcher,target.href,{method:'PUT',headers:{...headers,'Content-Type':mime,'Content-Length':String(bytes.byteLength)},body:bytes},120000);return responseId(done,/^[A-Za-z0-9_-]{11}$/)}catch{return unknown()}
}
