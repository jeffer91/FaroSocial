import {validDate,validateDraft} from './editor-core.js';
export const PROVIDERS=Object.freeze([{bit:1,id:'youtube',name:'YouTube'},{bit:2,id:'facebook',name:'Facebook'},{bit:4,id:'instagram',name:'Instagram'},{bit:8,id:'tiktok',name:'TikTok'}]);
export const MAX_ATTEMPTS=3;
export function scheduleTime(date,time,offset){
 if(!validDate(date)||typeof time!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)||typeof offset!=='string'||!/^([+-])(?:0[0-9]|1[0-4]):[0-5][0-9]$/.test(offset))throw Error('Fecha, hora y desfase UTC obligatorios.');
 const [h,m]=offset.slice(1).split(':').map(Number);if(h===14&&m!==0)throw Error('Desfase UTC inválido.');
 const utc=Date.parse(date+'T'+time+':00'+offset);if(!Number.isFinite(utc))throw Error('Fecha inválida.');return utc;
}
export function enqueueDraft(jobs,draft,offset,now=Date.now()){
 const v=validateDraft(draft),when=scheduleTime(v.planned_date,v.planned_time,offset);
 if(when<=now)throw Error('Selecciona una fecha futura.');
 if(!draft.id||!draft.brand_id)throw Error('Guarda primero el borrador.');
 const targets=PROVIDERS.filter(p=>v.platform_mask&p.bit);
 if(!targets.length||jobs.length+targets.length>100)throw Error('Límite de 100 trabajos en la demostración.');
 if(targets.some(p=>jobs.some(j=>j.draft_id===draft.id&&j.provider===p.id)))throw Error('El borrador ya tiene trabajos en la cola.');
 return [...jobs,...targets.map(p=>({id:draft.id+':'+p.id,draft_id:draft.id,brand_id:draft.brand_id,provider:p.id,title:v.title,scheduled_at:when,available_at:when,offset,status:'queued',attempts:0,lease:null}))];
}
export function claimJob(job,now,lease){
 if(!['queued','retry'].includes(job.status)||job.available_at>now||job.attempts>=MAX_ATTEMPTS||typeof lease!=='string'||!lease)throw Error('Trabajo no disponible.');
 return {...job,status:'processing',attempts:job.attempts+1,lease};
}
export function finishJob(job,lease,outcome,now){
 if(job.status!=='processing'||job.lease!==lease)throw Error('Intento no vigente.');
 const base={...job,lease:null};
 if(outcome==='success')return {...base,status:'succeeded'};
 if(outcome==='unknown')return {...base,status:'review'};
 if(outcome==='permanent')return {...base,status:'failed'};
 if(outcome==='safe_retry')return job.attempts>=MAX_ATTEMPTS?{...base,status:'failed'}:{...base,status:'retry',available_at:now+60000*2**(job.attempts-1)};
 throw Error('Resultado inválido.');
}
export function cancelJob(job){if(!['queued','retry'].includes(job.status))throw Error('No se puede cancelar este estado.');return {...job,status:'cancelled'}}
export function expireLease(job,lease){if(job.status!=='processing'||job.lease!==lease)throw Error('Intento no vigente.');return {...job,status:'review',lease:null}}
