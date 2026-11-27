import {validDate} from '../../assets/editor-core.js';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const str=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=max;
export function validateWrite(path,b){
 if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Datos inválidos');
 const only=(keys)=>{if(Object.keys(b).some(k=>!keys.includes(k)))throw Error('Campo no permitido')};
 if(path==='/v1/access-request'){only([]);return {}}
 if(path==='/v1/workspaces'){only(['name']);if(!str(b.name,80))throw Error('Nombre inválido');return {name:b.name.trim()}}
 if(path==='/v1/brands'){only(['workspace_id','name']);if(!uuid.test(b.workspace_id||'')||!str(b.name,80))throw Error('Marca inválida');return {workspace_id:b.workspace_id,name:b.name.trim()}}
 if(path==='/v1/drafts'){only(['id','brand_id','title','description','platform_mask','planned_date','planned_time','media_id']);if(!uuid.test(b.id||'')||!uuid.test(b.brand_id||'')||!(b.media_id===undefined||b.media_id===null||typeof b.media_id==='string'&&uuid.test(b.media_id))||!str(b.title,100)||typeof b.description!=='string'||b.description.length>2200||!Number.isInteger(b.platform_mask)||b.platform_mask<1||b.platform_mask>15||!(b.planned_date===null||validDate(b.planned_date))||!(b.planned_time===null||b.planned_date&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.planned_time)))throw Error('Borrador inválido');return {...b,media_id:b.media_id??null,title:b.title.trim(),description:b.description.trim()}}
 throw Error('Ruta inválida')
}
export async function readJson(req){
 if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!req.body)throw Error('Se requiere JSON');
 const r=req.body.getReader(),chunks=[];let bytes=0;
 try{while(true){const {done,value}=await r.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await r.cancel();throw Error('Solicitud demasiado grande')}chunks.push(value)}}finally{r.releaseLock()}
 const buffer=new Uint8Array(bytes);let pos=0;for(const c of chunks){buffer.set(c,pos);pos+=c.byteLength}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
}
