import {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
export const random=()=>randomBytes(32).toString('base64url');
export const challenge=v=>createHash('sha256').update(v).digest('base64url');
export const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
export function seal(value,key){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64')}
export function open(value,key){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'))}
export function vault(dir,key){const path=join(dir,'youtube.enc');return {async read(){try{return open(await readFile(path,'utf8'),key)}catch(e){if(e.code==='ENOENT')return null;throw e}},async save(value){await mkdir(dir,{recursive:true,mode:0o700});const temp=join(dir,random()+'.tmp');await writeFile(temp,seal(value,key),{mode:0o600,flag:'wx'});await rename(temp,path)},async clear(){try{await unlink(path)}catch(e){if(e.code!=='ENOENT')throw e}}}}
export function stateStore(){const m=new Map();return {create(session){for(const [k,v] of m)if(v.exp<Date.now())m.delete(k);if(m.size>=100)throw Error('Demasiadas autorizaciones');const state=random(),verifier=random();m.set(state,{session,verifier,exp:Date.now()+600000});return {state,verifier}},take(state,session){const v=m.get(state);if(!v||!equal(v.session,session)||v.exp<Date.now())return null;m.delete(state);return v}}}
