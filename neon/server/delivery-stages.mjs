// Staged provider operations. No worker or public media grant is connected here.
// Store references durably before continuing; never restart after an uncertain write.
export const pending=(provider,reference,stage)=>({outcome:'pending',provider,reference,stage});
export const confirmed=(provider,reference,external_post_id=null)=>({outcome:'confirmed',provider,reference,external_post_id});
export function trustedMedia(url,verifiedOrigin){
 try{const u=new URL(url),o=new URL(verifiedOrigin);return u.protocol==='https:'&&o.protocol==='https:'&&o.origin===verifiedOrigin&&u.origin===o.origin&&!u.username&&!u.password&&!u.hash&&u.pathname.startsWith('/delivery-media/')&&u.pathname.length>16&&u.href.length<=2048}catch{return false}
}
export const numericId=x=>typeof x==='string'&&/^\d{1,32}$/.test(x);
