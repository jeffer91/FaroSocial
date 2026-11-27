import {createRemoteJWKSet,jwtVerify} from 'jose';
import {Pool} from 'pg';
import {createHandler} from './handler.mjs';
import {createReader} from './reader.mjs';
const env=process.env;
// Only this isolated development branch; fail closed anywhere else.
if(env.NEON_BRANCH_ID!=='br-damp-scene-bbnr2g7d')throw Error('Development branch required');
const auth=new URL(env.NEON_AUTH_BASE_URL);
const jwksUrl=new URL(env.NEON_AUTH_JWKS_URL);
if(auth.protocol!=='https:'||jwksUrl.protocol!=='https:'||jwksUrl.origin!==auth.origin)throw Error('Invalid Auth configuration');
const jwks=createRemoteJWKSet(jwksUrl,{timeoutDuration:5000,cooldownDuration:30000});
const pool=new Pool({connectionString:env.DATABASE_URL,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,allowExitOnIdle:true});
pool.on('error',()=>{console.error('Database pool connection error')});
const authenticate=async token=>{
 const {payload}=await jwtVerify(token,jwks,{issuer:auth.origin,algorithms:['EdDSA'],requiredClaims:['sub','iat','exp'],maxTokenAge:'15 minutes',clockTolerance:5});
 // Only the application-account allowlist authorizes access; real live-session
 // and audience binding must be verified before commercial deployment.
 return payload.sub;
};
export default createHandler({authenticate,read:createReader(pool),allowedOrigins:[]});
