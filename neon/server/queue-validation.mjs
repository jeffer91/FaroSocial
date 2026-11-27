import {scheduleTime,PROVIDERS} from '../../assets/queue-core.js';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const validId=x=>typeof x==='string'&&uuid.test(x);
export function validateSchedule(b,now=Date.now()){
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['draft_id','connection_ids','date','time','offset'].includes(k))||!validId(b.draft_id)||!Array.isArray(b.connection_ids)||b.connection_ids.length<1||b.connection_ids.length>40||!b.connection_ids.every(validId)||new Set(b.connection_ids.map(x=>x.toLowerCase())).size!==b.connection_ids.length)throw Error('Selección inválida');
 const when=scheduleTime(b.date,b.time,b.offset);if(when<=now||when>now+365*86400000)throw Error('Fecha fuera de rango');
 return {draft_id:b.draft_id,connection_ids:b.connection_ids,scheduled_at:new Date(when).toISOString(),offset:b.offset};
}
export function snapshot(draft,connections,media){
 if(!draft||!connections.length)throw Error('Borrador o conexiones no disponibles');
 const required=PROVIDERS.filter(p=>draft.platform_mask&p.bit).map(p=>p.id);
 if(connections.some(c=>c.brand_id!==draft.brand_id||c.status!=='connected'||!required.includes(c.provider))||required.some(p=>!connections.some(c=>c.provider===p)))throw Error('Redes no coinciden con el borrador');
 if(draft.media_id&&(!media||media.id!==draft.media_id||media.upload_state!=='ready'||media.brand_id!==draft.brand_id))throw Error('Archivo no disponible');
 for(const c of connections){if(['youtube','tiktok'].includes(c.provider)&&media?.mime_type!=='video/mp4')throw Error('La red requiere MP4');if(c.provider==='instagram'&&!['image/jpeg','video/mp4'].includes(media?.mime_type))throw Error('Instagram requiere JPG o MP4')}
 return {title:draft.title,description:draft.description,media_id:media?.id??null,mime_type:media?.mime_type??null,byte_size:media?.byte_size??null,storage_path:media?.storage_path??null};
}
export function monthBounds(iso){const d=new Date(iso),y=d.getUTCFullYear(),m=d.getUTCMonth();return [new Date(Date.UTC(y,m,1)).toISOString(),new Date(Date.UTC(y,m+1,1)).toISOString()]}
