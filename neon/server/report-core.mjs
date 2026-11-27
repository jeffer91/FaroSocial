import {validDate} from '../../assets/editor-core.js';
import {validId} from './queue-validation.mjs';
export const providers=['youtube','facebook','instagram','tiktok'];
export function reportInput(url){
 const keys=[...url.searchParams.keys()];if(keys.length!==3||!['brand','from','to'].every(k=>keys.includes(k)))throw Error('Parámetros inválidos');
 const brand=url.searchParams.get('brand'),from=url.searchParams.get('from'),to=url.searchParams.get('to');
 if(!validId(brand)||!validDate(from)||!validDate(to))throw Error('Fecha o marca inválida');
 const a=Date.parse(from+'T00:00:00Z'),b=Date.parse(to+'T00:00:00Z');if(b<a||b-a>365*86400000)throw Error('Período máximo: 366 días');
 return {brand,from,to,end:new Date(b+86400000).toISOString().slice(0,10)};
}
export function summarize(rows){
 const states=['queued','processing','retry','awaiting','succeeded','review','failed','cancelled'];
 const byProvider=providers.map(provider=>({provider,...Object.fromEntries(states.map(k=>[k,0])),total:0}));
 for(const r of rows){const p=byProvider.find(x=>x.provider===r.provider);if(!p||!states.includes(r.status)||!Number.isSafeInteger(r.count)||r.count<0)throw Error('Invalid count');p[r.status]+=r.count;p.total+=r.count}
 const totals=Object.fromEntries([...states,'total'].map(k=>[k,byProvider.reduce((n,p)=>n+p[k],0)]));
 return {totals,byProvider}
}
const asCount=x=>{if(x===null||x===undefined)return null;const v=Number(x);return Number.isSafeInteger(v)&&v>=0?v:null};
export function snapshotMetric(first,last){const a=asCount(first),b=asCount(last);return {latest:b,change:a===null||b===null?null:b-a}}
export function accountMetrics(r){
 const different=Boolean(r.first_day&&r.last_day&&r.first_day!==r.last_day);
 const metric=(a,b)=>snapshotMetric(different?a:null,b);
 return {id:r.id,provider:r.provider,name:r.display_name,status:r.status,first_day:r.first_day??null,last_day:r.last_day??null,followers:metric(r.first_followers,r.last_followers),lifetime_views:metric(r.first_views,r.last_views),lifetime_posts:metric(r.first_posts,r.last_posts),interactions:null};
}
