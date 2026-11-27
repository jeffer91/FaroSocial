import {S3Client,GetObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
export function createDeliveryStorage(env){
 const s3=new S3Client({forcePathStyle:true,region:env.AWS_REGION,endpoint:env.AWS_ENDPOINT_URL_S3,maxAttempts:1});
 const validate=m=>{if(!m||typeof m.path!=='string'||!(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/i.test(m.path))||!['image/jpeg','image/png','image/webp','video/mp4'].includes(m.mime)||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>30*1048576)throw Error('Invalid media')};
 async function head(m){validate(m);const r=await s3.send(new HeadObjectCommand({Bucket:'faro-media',Key:m.path}),{abortSignal:AbortSignal.timeout(15000)});if(r.ContentLength!==m.bytes||r.ContentType!==m.mime)throw Error('Object mismatch')}
 async function read(m,range=null){await head(m);const expected=range?range.end-range.start+1:m.bytes;const r=await s3.send(new GetObjectCommand({Bucket:'faro-media',Key:m.path,...(range?{Range:'bytes='+range.start+'-'+range.end}:{})}),{abortSignal:AbortSignal.timeout(20000)});if(r.ContentLength!==expected||r.ContentType!==m.mime||!r.Body||(range&&r.ContentRange!=='bytes '+range.start+'-'+range.end+'/'+m.bytes)){r.Body?.destroy?.();throw Error('Object mismatch')}const bytes=new Uint8Array(expected);let n=0;try{for await(const chunk of r.Body){if(n+chunk.byteLength>expected)throw Error('Length mismatch');bytes.set(chunk,n);n+=chunk.byteLength}}finally{r.Body.destroy?.()}if(n!==expected)throw Error('Length mismatch');return bytes}
 return {head,read}
}
