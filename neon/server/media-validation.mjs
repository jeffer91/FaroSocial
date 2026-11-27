import {mediaInfo,MIB} from '../../assets/media-core.js';
export const limits=Object.freeze({count:50,bytes:100*MIB});
const id=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const validId=x=>typeof x==='string'&&id.test(x);
const ascii=(b,start,n)=>String.fromCharCode(...b.subarray(start,start+n));
export function matchesMime(b,m){
 if(m==='image/jpeg')return b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255&&b.at(-2)===255&&b.at(-1)===217;
 if(m==='image/png')return b.length>=24&&[137,80,78,71,13,10,26,10].every((x,i)=>x===b[i])&&ascii(b,12,4)==='IHDR';
 if(m==='image/webp')return b.length>=16&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(ascii(b,12,4));
 if(m==='video/mp4')return b.length>=16&&ascii(b,4,4)==='ftyp'&&new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0)>=16;
 return false;
}
export async function readUpload(req){
 const name=decodeURIComponent(req.headers.get('x-file-name')||''),brand=req.headers.get('x-brand-id'),type=req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
 const size=Number(req.headers.get('x-file-size'));if(!validId(brand)||/[\x00-\x1f\x7f/\\]/.test(name))throw Error('Archivo inválido');
 const info=mediaInfo({name,type,size});if(!req.body)throw Error('Archivo vacío');
 const reader=req.body.getReader(),buffer=new Uint8Array(size);let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(total+value.byteLength>size){await reader.cancel();throw Error('Tamaño excedido')}buffer.set(value,total);total+=value.byteLength}}finally{reader.releaseLock()}
 if(total!==size||!matchesMime(buffer,type))throw Error('Contenido o tamaño inválido');
 return {brand,info,buffer};
}
