import {createAuthClient} from '@neon/auth';
const expected="https://br-damp-scene-bbnr2g7d-farosocialapi.compute.c-15.us-east-1.aws.neon.tech",authUrl="https://ep-noisy-cherry-bb524mc3.neonauth.c-15.us-east-1.aws.neon.tech/farosocial/auth";
const $=id=>document.getElementById(id),status=$('status'),signin=$('sign-in'),verify=$('verify'),signout=$('sign-out');
let busy=false;
function controls(value){busy=value;for(const button of [signin,verify,signout])button.disabled=value}
const client=location.origin===expected?createAuthClient(authUrl):null;
async function inspect(){
 const session=await client.getSession();
 if(session.error)throw Error('No se pudo comprobar la sesión.');
 if(!session.data?.user){status.textContent='Sin sesión. Continúa con Google para realizar la prueba.';return}
 const result=await client.token(),token=result.data?.token;
 if(result.error||typeof token!=='string')throw Error('No se pudo obtener el token de prueba.');
 const r=await fetch('/v1/me',{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error'});
 if(r.status===403){status.textContent='Identidad Google verificada. La cuenta todavía no está habilitada en FaroSocial. Solicita su habilitación al administrador.';return}
 if(r.status===401){status.textContent='La sesión de Google existe, pero el servidor rechazó el token. Acceso bloqueado.';return}
 if(!r.ok){status.textContent='No se pudo consultar el servidor (HTTP '+r.status+').';return}
 const body=await r.json();
 if(!Array.isArray(body.data)||body.data.length!==1)throw Error('Respuesta inesperada.');
 status.textContent='Sesión y cuenta verificadas. Acceso de prueba de solo lectura.';
}
async function run(action){if(busy||!client)return;controls(true);try{await action()}catch{status.textContent='No se pudo completar la operación. Reintenta o verifica que el navegador permita el flujo de Google.'}finally{controls(false)}}
signin.addEventListener('click',()=>run(async()=>{status.textContent='Abriendo autorización de Google…';const r=await client.signIn.social({provider:'google',callbackURL:expected+'/preview'});if(r?.error)throw Error('No se completó el acceso.');await inspect()}));
verify.addEventListener('click',()=>run(inspect));
signout.addEventListener('click',()=>run(async()=>{const r=await client.signOut();if(r?.error)throw Error();await inspect()}));
if(client)run(inspect);else status.textContent='Origen incorrecto. Acceso de prueba desactivado.';
