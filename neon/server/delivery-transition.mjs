export function transition(job,result){
 const ref=typeof result?.reference==='string'&&/^[A-Za-z0-9_.~:-]{1,128}$/.test(result.reference)?result.reference:null;
 const external=typeof result?.external_post_id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(result.external_post_id)?result.external_post_id:null;
 const provider=job.payload?.provider;
 const known=job.provider_reference||null;
 const base={status:'review',stage:job.delivery_stage||'new',reference:known,external:null,delay:0};
 if(ref&&known&&ref!==known)return base;
 if(result?.outcome==='success'&&external&&['youtube','facebook'].includes(provider)&&!known)return {...base,status:'succeeded',stage:'complete',external};
 if(result?.provider&&result.provider!==provider)return base;
 if(result?.outcome==='confirmed'&&['instagram','tiktok'].includes(provider)&&ref)return {...base,status:'succeeded',stage:'complete',reference:ref,external};
 if(result?.outcome==='permanent')return {...base,status:'failed',reference:known||ref};
 if(job.delivery_stage==='publish_intent')return {...base,reference:known||ref}; // never repeat final publish after ambiguity
 if(result?.outcome==='pending'&&ref&&['instagram','tiktok'].includes(provider)&&['container','processing','ready','poll_error'].includes(result.stage)&&!(provider==='tiktok'&&result.stage==='ready')){
  if(job.poll_count>=60)return {...base,reference:ref};
  return {...base,status:'awaiting',stage:result.stage,reference:ref,delay:60};
 }
 if(result?.outcome==='safe_retry'&&!known&&job.delivery_stage==='new')return {...base,status:job.attempts<3?'retry':'failed',delay:60*2**Math.max(0,job.attempts-1)};
 return {...base,reference:known||ref}
}
