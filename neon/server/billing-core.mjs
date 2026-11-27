import {validId} from './queue-validation.mjs';
export const planCodes=['free','personal','pro','business'];
export function validatePlanRequest(b){if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==2||!validId(b.workspace_id)||!planCodes.includes(b.requested_plan))throw Error('Solicitud inválida');return {workspace_id:b.workspace_id,requested_plan:b.requested_plan}}
export function validateCancel(b){if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==1||!validId(b.id))throw Error('Solicitud inválida');return {id:b.id}}
export function quota(used,max){if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(max)||max<1)throw Error('Cupo inválido');return {used,max,remaining:Math.max(0,max-used),exceeded:used>max}}
export function utcMonth(now=new Date()){const y=now.getUTCFullYear(),m=now.getUTCMonth();return [new Date(Date.UTC(y,m,1)).toISOString(),new Date(Date.UTC(y,m+1,1)).toISOString()]}
