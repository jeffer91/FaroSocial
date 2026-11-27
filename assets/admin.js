const $=id=>document.getElementById(id);
export function initAdmin(client){
 let generation=0,page=0,allowed=false,busy=false;
 const panel=$('admin-panel'),nav=$('admin-nav'),rows=$('admin-rows'),status=$('admin-status');
 function clear(){rows.replaceChildren();for(const id of ['admin-workspaces','admin-brands','admin-connected','admin-incidents'])$(id).textContent='—';$('admin-page').textContent='';$('admin-prev').disabled=true;$('admin-next').disabled=true}
 function reset(){generation++;allowed=false;busy=false;page=0;panel.hidden=true;nav.hidden=true;clear();status.textContent='';$('admin-plan').value='all';$('admin-refresh').disabled=true}
 async function load(){
  if(!allowed||busy||!client.isSignedIn())return;
  const g=++generation;busy=true;clear();$('admin-refresh').disabled=true;$('admin-plan').disabled=true;status.textContent='Consultando datos administrativos...';
  try{
   const data=await client.adminReport(page,$('admin-plan').value);
   if(g!==generation||!allowed||!client.isSignedIn())return;
   if(!data||!Array.isArray(data.items)||data.items.length>25||!['workspaces','brands','connected','incidents','filtered'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0))throw Error();
   for(const k of ['workspaces','brands','connected','incidents'])$('admin-'+k).textContent=data[k].toLocaleString('es-EC');
   for(const item of data.items){
    const tr=document.createElement('tr');for(const value of [item.name,item.plan_code,item.brands,item.connected,item.created_at?new Date(item.created_at).toLocaleDateString('es-EC'):'—']){const td=document.createElement('td');td.textContent=String(value??'—');tr.append(td)}rows.append(tr)
   }
   $('admin-page').textContent='Página '+(page+1)+' · '+data.filtered+' espacios';
   $('admin-prev').disabled=page===0;$('admin-next').disabled=(page+1)*25>=data.filtered||page>=10000;
   status.textContent=data.items.length?'Datos consultados correctamente.':'No hay espacios para este filtro.';
  }catch{if(g!==generation)return;clear();status.textContent='No se pudo consultar el reporte. Verifica permisos y servicio.'}
  finally{if(g===generation){busy=false;$('admin-refresh').disabled=false;$('admin-plan').disabled=false}}
 }
 $('admin-refresh').addEventListener('click',load);
 $('admin-plan').addEventListener('change',()=>{page=0;load()});
 $('admin-prev').addEventListener('click',()=>{if(!busy&&page>0){page--;load()}});
 $('admin-next').addEventListener('click',()=>{if(!busy&&page<10000){page++;load()}});
 nav.addEventListener('click',()=>{if(allowed)load()});
 return {reset,enable(){reset();allowed=true;nav.hidden=false;panel.hidden=false;$('admin-plan').disabled=false;$('admin-refresh').disabled=false;status.textContent='Reporte de solo lectura. Pulsa actualizar para consultar.'}};
}
