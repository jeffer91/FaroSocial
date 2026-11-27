import {config} from './cloud-config.js';
import {cloudClient,validateConfig} from './cloud-core.js';
const $=id=>document.getElementById(id);
export function initCloud(){
 $('workspace').hidden=false;
 if(!validateConfig(config)){$('cloud-status').textContent='Proyecto de FaroSocial pendiente de vinculación. El acceso y las conexiones están bloqueados.';return}
 const client=cloudClient(config);
 let busy=false;
 function reset(){ $('cloud-login').hidden=false;$('cloud-login-fields').disabled=false;$('cloud-account').hidden=true;$('brand-fields').disabled=true;$('cloud-password').value='';$('brand-name').value='';$('brand-list').replaceChildren();$('cloud-user').textContent='';$('brand-status').textContent=''; }
 async function refresh(){
  try{const rows=await client.brands();if(!Array.isArray(rows))throw Error();$('brand-list').replaceChildren();for(const row of rows){const li=document.createElement('li');li.textContent=row.name;$('brand-list').append(li)}if(!rows.length){const li=document.createElement('li');li.textContent='Todavía no tienes marcas.';$('brand-list').append(li)}$('brand-status').textContent='Marcas sincronizadas.'}
  catch{$('brand-status').textContent='No se pudo consultar las marcas.';if(!client.isSignedIn()){reset();$('cloud-status').textContent='Sesión finalizada. Inicia sesión de nuevo.'}}
 }
 reset();$('cloud-status').textContent='Inicia sesión con una cuenta autorizada de FaroSocial.';
 $('cloud-login').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;$('cloud-login-fields').disabled=true;try{const user=await client.signIn($('cloud-email').value.trim(),$('cloud-password').value);$('cloud-login').hidden=true;$('cloud-account').hidden=false;$('brand-fields').disabled=false;$('cloud-user').textContent=user.email;$('cloud-status').textContent='Sesión iniciada. Las conexiones sociales todavía no están habilitadas.';await refresh()}catch{$('cloud-status').textContent='No se pudo iniciar sesión. Comprueba tus datos y vuelve a intentar.'}finally{$('cloud-password').value='';$('cloud-login-fields').disabled=false;busy=false}});
 $('cloud-logout').addEventListener('click',async()=>{if(busy)return;busy=true;try{await client.signOut();$('cloud-status').textContent='Sesión cerrada.'}catch{$('cloud-status').textContent='Sesión local cerrada. No se confirmó la revocación remota.'}finally{reset();busy=false}});
 $('brand-form').addEventListener('submit',async e=>{e.preventDefault();if(busy||!client.isSignedIn())return;busy=true;$('brand-fields').disabled=true;try{await client.createBrand($('brand-name').value);$('brand-name').value='';await refresh()}catch{$('brand-status').textContent='No se confirmó la creación de la marca. Verifica antes de reintentar.'}finally{$('brand-fields').disabled=!client.isSignedIn();busy=false}});
}
