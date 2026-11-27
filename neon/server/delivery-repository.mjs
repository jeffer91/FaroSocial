import {open,seal,config as youtubeConfig} from './youtube-oauth.mjs';
import {metaConfig} from './meta-oauth.mjs';
import {tiktokConfig} from './tiktok-oauth.mjs';
import {issueGrant} from './delivery-grant.mjs';
export function createDeliveryRepository(pool,env,{storage}={}){
 const key=()=>{const raw=env.FARO_MEDIA_SIGNING_KEY;if(typeof raw!=='string'||!(/^[A-Za-z0-9+/]{43}=$/.test(raw)))throw Error('Signing key unavailable');return Buffer.from(raw,'base64')};
 const providerConfig=p=>p==='youtube'?youtubeConfig(env):p==='tiktok'?tiktokConfig(env):['facebook','instagram'].includes(p)?metaConfig(env):null;
 const binding=(p,id)=>p==='youtube'?id:p+':'+id;
 async function query(role,sql,params){if(!['faro_worker','faro_delivery_media'].includes(role))throw Error('Role invalid');const c=await pool.connect();let broken=false;try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role '+role);const r=await c.query(sql,params);await c.query('commit');return r.rows[0]?.value??null}catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}}
 async function raw(job){return query('faro_worker','select faro_private.job_context($1,$2) as value',[job.id,job.lease_id])}
 async function loadContext(job){const r=await raw(job);if(!r||r.refreshOwner)return null;const config=providerConfig(r.provider);if(!config)return null;const credentials=open(config.key,binding(r.provider,r.connectionId),r.ciphertext);const {ciphertext,refreshOwner,revision,...publicFields}=r;return {...publicFields,credentials,config,version:revision,audited:false}}
 async function reserveRefresh(job,revision){return await query('faro_worker','select faro_private.reserve_refresh($1,$2,$3) as value',[job.id,job.lease_id,revision])===true}
 async function saveCredentials(job,revision,next){const c=providerConfig(job.payload.provider);if(!c)return false;return await query('faro_worker','select faro_private.save_refresh($1,$2,$3,$4) as value',[job.id,job.lease_id,revision,seal(c.key,binding(job.payload.provider,job.connection_id),next)])===true}
 async function loadBytes(job){const r=await raw(job);if(!r?.media||!storage)throw Error('File unavailable');return storage.read(r.media)}
 async function issueMedia(job){const r=await raw(job);if(!r?.media||!env.FARO_VERIFIED_MEDIA_ORIGIN)throw Error('File unavailable');if(r.provider==='tiktok')throw Error('Trusted video duration not available');const origin=env.FARO_VERIFIED_MEDIA_ORIGIN;return {url:issueGrant({key:key(),origin,jobId:job.id,mediaId:r.media.id,provider:r.provider,ttl:1800}),origin}}
 async function resolveGrant(grant){return query('faro_delivery_media','select faro_private.delivery_file($1,$2,$3) as value',[grant.j,grant.m,grant.p])}
 return {loadContext,reserveRefresh,saveCredentials,loadBytes,issueMedia,resolveGrant}
}
