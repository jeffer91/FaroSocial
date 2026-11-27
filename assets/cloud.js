import {initEditor} from './editor.js';
import {initAdmin} from './admin.js';
import {config} from './cloud-config.js';
import {cloudClient,validateConfig,beginGoogle,takeVerifier,CALLBACK} from './cloud-core.js';
const $=id=>document.getElementById(id);
export async function initCloud(){
 $('workspace').hidden=false;
 const q=new URLSearchParams(location.search),code=q.get('code'),callback=q.has('code')||q.has('error')||location.hash.includes('access_token=');
 if(callback)history.replaceState(null,'',location.pathname);
 if(!validateConfig(config)||location.origin+location.pathname!==CALLBACK){
  $('cloud-status').textContent='Acceso con Google pendiente de configurar en el proyecto exclusivo de FaroSocial.';initEditor().showDemo();return;
 }
 const client=cloudClient(config);let busy=false,workspace=null,brands=[];const admin=initAdmin(client),editor=initEditor(client);
 function clearWorkspace(){editor.reset();workspace=null;brands=[];$('workspace-create').hidden=true;$('workspace-detail').hidden=true;$('brand-fields').disabled=true;$('workspace-create-fields').disabled=true;$('brand-list').replaceChildren();$('workspace-title').textContent='';$('workspace-plan').textContent='';}
 function gate(open){document.body.classList.toggle('login-only',!open);$('cloud-login').hidden=open;$('cloud-account').hidden=!open;$('google-login').disabled=busy;if(!open){admin.reset();clearWorkspace();$('workspace-name').value='';$('brand-name').value='';$('cloud-user').textContent='';$('brand-status').textContent=''}}
 function freeSlot(){if(!workspace)return 0;const used=new Set(brands.map(b=>b.slot));for(let i=1;i<=workspace.faro_plans.max_brands;i++)if(!used.has(i))return i;return 0}
 async function refresh(){
  clearWorkspace();
  try{
   const rows=await client.workspaces();if(!Array.isArray(rows)||rows.length>1)throw Error();
   if(!rows.length){$('workspace-create').hidden=false;$('workspace-create-fields').disabled=false;$('brand-status').textContent='Crea tu espacio de trabajo para comenzar.';return}
   const w=rows[0],plan=w.faro_plans;if(!plan||!Number.isInteger(plan.max_brands)||plan.max_brands<1||plan.max_brands>100)throw Error();
   const data=await client.brands(w.id);if(!Array.isArray(data))throw Error();
   if(!client.isSignedIn())throw Error();
   workspace=w;brands=data;editor.showBrands(brands);$('workspace-title').textContent=w.name;
   $('workspace-plan').textContent='Plan '+plan.name+' · '+brands.length+' de '+plan.max_brands+' marcas';
   for(const row of brands){const li=document.createElement('li');li.textContent=row.name;$('brand-list').append(li)}
   if(!brands.length){const li=document.createElement('li');li.textContent='Todavía no tienes marcas.';$('brand-list').append(li)}
   $('workspace-detail').hidden=false;$('brand-fields').disabled=!freeSlot();$('brand-status').textContent=freeSlot()?'Marcas sincronizadas.':'Has alcanzado el límite de marcas de tu plan.';
  }catch{$('brand-status').textContent='No se pudo consultar el espacio de trabajo.';if(!client.isSignedIn()){gate(false);$('cloud-status').textContent='Sesión finalizada. Inicia sesión de nuevo.'}}
 }
 gate(false);$('cloud-status').textContent='Utiliza una cuenta de Google autorizada.';
 $('google-login').addEventListener('click',async()=>{if(busy)return;busy=true;$('google-login').disabled=true;try{location.assign(await beginGoogle(config,sessionStorage))}catch{busy=false;$('google-login').disabled=false;$('cloud-status').textContent='No se pudo iniciar la autorización. Comprueba el navegador.'}});
 $('cloud-logout').addEventListener('click',async()=>{if(busy)return;busy=true;try{await client.signOut();$('cloud-status').textContent='Sesión cerrada.'}catch{$('cloud-status').textContent='Sesión local cerrada. No se confirmó la revocación remota.'}finally{busy=false;gate(false)}});
 $('workspace-create').addEventListener('submit',async e=>{e.preventDefault();if(busy||!client.isSignedIn()||workspace)return;busy=true;$('workspace-create-fields').disabled=true;try{await client.createWorkspace($('workspace-name').value);$('workspace-name').value='';await refresh()}catch{await refresh();$('brand-status').textContent='Verifica el estado antes de volver a crear un espacio.'}finally{busy=false}});
 $('brand-form').addEventListener('submit',async e=>{e.preventDefault();const slot=freeSlot();if(busy||!client.isSignedIn()||!workspace||!slot)return;busy=true;$('brand-fields').disabled=true;try{await client.createBrand(workspace.id,$('brand-name').value,slot);$('brand-name').value='';await refresh()}catch{await refresh();$('brand-status').textContent='No se confirmó la creación. Revisa el cupo y las marcas antes de reintentar.'}finally{$('brand-fields').disabled=!client.isSignedIn()||!freeSlot();busy=false}});
 if(callback){busy=true;$('google-login').disabled=true;$('cloud-status').textContent='Verificando autorización...';try{const verifier=takeVerifier(sessionStorage);if(!code||!verifier||q.has('error'))throw Error();const user=await client.exchange(code,verifier);$('cloud-user').textContent=[user.name,user.email].filter(Boolean).join(' · ');$('cloud-status').textContent='Sesión iniciada. Vincula tus redes cuando estén disponibles.';gate(true);if(user.admin)admin.enable();await refresh()}catch{gate(false);$('cloud-status').textContent='No se completó el acceso. La cuenta debe estar autorizada. Vuelve a intentar.'}finally{busy=false;$('google-login').disabled=false}}
 setInterval(()=>{if(!busy&&!$('cloud-account').hidden&&!client.isSignedIn()){gate(false);$('cloud-status').textContent='Sesión vencida. Continúa con Google para ingresar nuevamente.'}},15000);
}
