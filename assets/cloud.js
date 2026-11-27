import {config} from './cloud-config.js';
import {cloudClient,validateConfig,beginGoogle,takeVerifier,CALLBACK} from './cloud-core.js';
const $=id=>document.getElementById(id);
export async function initCloud(){
 $('workspace').hidden=false;
 const q=new URLSearchParams(location.search),code=q.get('code'),callback=q.has('code')||q.has('error')||location.hash.includes('access_token=');
 if(callback)history.replaceState(null,'',location.pathname);
 if(!validateConfig(config)||location.origin+location.pathname!==CALLBACK){
  $('cloud-status').textContent='Acceso con Google pendiente de configurar en el proyecto exclusivo de FaroSocial.';
  return;
 }
 const client=cloudClient(config);let busy=false;
 function gate(open){
  document.body.classList.toggle('login-only',!open);
  $('cloud-login').hidden=open;$('cloud-account').hidden=!open;
  $('google-login').disabled=busy;$('brand-fields').disabled=!open;
  if(!open){$('brand-name').value='';$('brand-list').replaceChildren();$('cloud-user').textContent='';$('brand-status').textContent=''}
 }
 async function refresh(){
  try{const rows=await client.brands();if(!Array.isArray(rows))throw Error();$('brand-list').replaceChildren();for(const row of rows){const li=document.createElement('li');li.textContent=row.name;$('brand-list').append(li)}if(!rows.length){const li=document.createElement('li');li.textContent='Todavía no tienes marcas.';$('brand-list').append(li)}$('brand-status').textContent='Marcas sincronizadas.'}
  catch{$('brand-status').textContent='No se pudo consultar las marcas.';if(!client.isSignedIn()){gate(false);$('cloud-status').textContent='Sesión finalizada. Inicia sesión de nuevo.'}}
 }
 gate(false);$('cloud-status').textContent='Utiliza una cuenta de Google autorizada.';
 $('google-login').addEventListener('click',async()=>{if(busy)return;busy=true;$('google-login').disabled=true;try{location.assign(await beginGoogle(config,sessionStorage))}catch{busy=false;$('google-login').disabled=false;$('cloud-status').textContent='No se pudo iniciar la autorización. Comprueba el navegador.'}});
 $('cloud-logout').addEventListener('click',async()=>{if(busy)return;busy=true;try{await client.signOut();$('cloud-status').textContent='Sesión cerrada.'}catch{$('cloud-status').textContent='Sesión local cerrada. No se confirmó la revocación remota.'}finally{busy=false;gate(false)}});
 $('brand-form').addEventListener('submit',async e=>{e.preventDefault();if(busy||!client.isSignedIn())return;busy=true;$('brand-fields').disabled=true;try{await client.createBrand($('brand-name').value);$('brand-name').value='';await refresh()}catch{$('brand-status').textContent='No se confirmó la creación de la marca. Verifica antes de reintentar.'}finally{$('brand-fields').disabled=!client.isSignedIn();busy=false}});
 if(callback){busy=true;$('google-login').disabled=true;$('cloud-status').textContent='Verificando autorización...';try{const verifier=takeVerifier(sessionStorage);if(!code||!verifier||q.has('error'))throw Error();const user=await client.exchange(code,verifier);$('cloud-user').textContent=[user.name,user.email].filter(Boolean).join(' · ');$('cloud-status').textContent='Sesión iniciada. Vincula tus redes cuando estén disponibles.';gate(true);await refresh()}catch{gate(false);$('cloud-status').textContent='No se completó el acceso. La cuenta debe estar autorizada. Vuelve a intentar.'}finally{busy=false;$('google-login').disabled=false}}
 setInterval(()=>{if(!$('cloud-account').hidden&&!client.isSignedIn()){gate(false);$('cloud-status').textContent='Sesión vencida. Continúa con Google para ingresar nuevamente.'}},15000);
}
