import {randomUUID} from 'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {readUpload,limits,validId} from './media-validation.mjs';
const BUCKET='faro-media';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createMedia(pool,env){
 const s3=new S3Client({forcePathStyle:true,region:env.AWS_REGION,endpoint:env.AWS_ENDPOINT_URL_S3,maxAttempts:1});
 async function tx(subject,fn){const c=await pool.connect();let broken=false;try{await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query('set local role faro_api');await c.query("select set_config('faro.subject',$1,true)",[subject]);const a=await c.query('select id from faro.accounts limit 1');if(a.rowCount!==1){await c.query('rollback');return null}const r=await fn(c,a.rows[0].id);await c.query('commit');return r}catch(e){try{await c.query('rollback')}catch{broken=true}throw e}finally{c.release(broken?true:undefined)}}
 return async(subject,req)=>{
  if(!env.AWS_ENDPOINT_URL_S3||!env.AWS_REGION||!env.AWS_ACCESS_KEY_ID||!env.AWS_SECRET_ACCESS_KEY)return json({error:'Almacenamiento no configurado'},503);
  const url=new URL(req.url);
  if(req.method==='POST'){
   if(url.search)return json({error:'Parámetros inválidos'},400);
   // Authenticate and check ownership before allocating the file buffer.
   const brand=req.headers.get('x-brand-id');if(!validId(brand))return json({error:'Marca inválida'},400);
   if(!await tx(subject,async c=>(await c.query('select id from faro.brands where id=$1',[brand])).rowCount===1))return json({error:'Marca no disponible'},403);
   let upload;try{upload=await readUpload(req)}catch{return json({error:'Formato o tamaño inválido'},400)}
   const {info,buffer}=upload;
   const reservation=await tx(subject,async(c,account)=>{
    await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[account]);
    const quota=(await c.query('select count(*)::int as count,coalesce(sum(byte_size),0)::bigint as bytes from faro.media')).rows[0];
    if(quota.count>=limits.count||Number(quota.bytes)+info.byte_size>limits.bytes)return {quota:true};
    const r=await c.query('insert into faro.media(id,brand_id,name,mime_type,byte_size) values($1,$2,$3,$4,$5) returning id,storage_path',[randomUUID(),brand,info.name,info.mime_type,info.byte_size]);return r.rows[0];
   });
   if(!reservation)return json({error:'Cuenta no habilitada'},403);if(reservation.quota)return json({error:'Cupo multimedia de beta agotado'},409);
   // A failed or ambiguous PUT leaves a pending reservation counted against quota.
   // A later reconciliation task must verify and clean these rows and objects.
   await s3.send(new PutObjectCommand({Bucket:BUCKET,Key:reservation.storage_path,Body:buffer,ContentType:info.mime_type,ContentLength:info.byte_size,CacheControl:'private, no-store'}),{abortSignal:AbortSignal.timeout(20000)});
   const ready=await tx(subject,async c=>(await c.query("update faro.media set upload_state='ready' where id=$1 returning id",[reservation.id])).rowCount===1);
   if(!ready)return json({error:'Archivo pendiente de revisión'},503);return json({data:{id:reservation.id}},201);
  }
  if(req.method==='GET'){
   const id=url.searchParams.get('id');if([...url.searchParams.keys()].length!==1||!validId(id))return json({error:'Archivo inválido'},400);
   const row=await tx(subject,async c=>(await c.query("select storage_path,mime_type,byte_size from faro.media where id=$1 and upload_state='ready'",[id])).rows[0]||null);
   if(!row)return json({error:'Archivo no disponible'},404);
   const response=await s3.send(new GetObjectCommand({Bucket:BUCKET,Key:row.storage_path}),{abortSignal:AbortSignal.timeout(20000)});
   if(response.ContentLength!==row.byte_size||response.ContentType!==row.mime_type||!response.Body){response.Body?.destroy?.();throw Error('Unexpected storage response')}
   const data=new Uint8Array(row.byte_size);let n=0;
   try{for await(const chunk of response.Body){if(n+chunk.byteLength>data.length)throw Error('Unexpected length');data.set(chunk,n);n+=chunk.byteLength}}finally{response.Body.destroy?.()}
   if(n!==data.length)throw Error('Incomplete object');
   return new Response(data,{headers:{'Content-Type':row.mime_type,'Content-Length':String(n),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  return json({error:'Método no permitido'},405)
 }
}
