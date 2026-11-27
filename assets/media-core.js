export const MIB=1048576;
export const mimeExtensions=Object.freeze({'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp'],'video/mp4':['mp4']});
export function mediaId(value){if(typeof value!=='string'||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))throw Error('Identificador de archivo inválido');return value}
export function mediaInfo(file){const name=String(file?.name||''),type=file?.type,size=file?.size,ext=name.split('.').at(-1).toLowerCase(),allowed=mimeExtensions[type];if(!name||name.length>180||!allowed||!allowed.includes(ext)||!Number.isSafeInteger(size)||size<=0||size>(type==='video/mp4'?30:10)*MIB)throw Error('Usa JPG, PNG o WebP de hasta 10 MiB, o MP4 de hasta 30 MiB.');return {name,mime_type:type,byte_size:size}}
export function demoCapacity(items,info){if(items.length>=20||items.reduce((sum,x)=>sum+x.byte_size,0)+info.byte_size>60*MIB)throw Error('Límite de demostración: 20 archivos y 60 MiB en total.')}
export function mediaPath(brand,id,mime){const ext=mimeExtensions[mime]?.[0];if(!ext)throw Error('Formato inválido');return mediaId(brand)+'/'+mediaId(id)+'.'+ext}
