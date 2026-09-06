import type {GeocodingProvider,Coordinates} from '../../../packages/domain/src/geocoding.js';
import type {ParkingCheckResult} from '../../../packages/domain/src/local-parking.js';
import {ApiError,validateCheck,queryCoordinates} from './validation.js';
import type {CheckInput} from './validation.js';
export interface ApiDependencies {
 geocoder:GeocodingProvider;check(input:CheckInput,now:string):Promise<ParkingCheckResult>;
 inCity(position:Coordinates):Promise<boolean>;ready():Promise<boolean>;
 now?:()=>number;log?:(event:string,status:number,durationMs:number)=>void;
}
/** Per-process bounded RAM limiter. Socket identity only; never trust forwarded headers. */
export class RateLimiter {
 private readonly entries=new Map<string,{count:number;until:number}>();
 take(key:string,limit:number,now:number):boolean {
  for(const [k,v] of this.entries)if(v.until<=now)this.entries.delete(k);
  const old=this.entries.get(key);
  if(!old){if(this.entries.size>=10000)return false;this.entries.set(key,{count:1,until:now+60000});return true;}
  if(old.count>=limit)return false;old.count++;return true;
 }
}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'geolocation=(self), camera=(), microphone=()'};
function json(value:unknown,status=200,extra:Record<string,string>={}):Response{return new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});}
export function createApi(d:ApiDependencies,limiter=new RateLimiter()):(request:Request,client:string)=>Promise<Response> {
 const now=d.now??Date.now;
 return async(request,client)=>{
  const begun=performance.now(),url=new URL(request.url);let event='parking.check.error',status=500;
  try {
   const origin=request.headers.get('origin');
   if(origin&&origin!==url.origin)throw new ApiError(403,'ORIGIN_REJECTED','Requête non autorisée.');
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'ORIGIN_REJECTED','Requête non autorisée.');
   if(url.pathname==='/api/health'&&request.method==='GET'){status=200;event='health';return json({status:'ok'});}
   if(url.pathname==='/api/ready'&&request.method==='GET'){const ready=await d.ready();status=ready?200:503;event='readiness';return json({status:ready?'ok':'unavailable'},status);}
   const kind=url.pathname==='/api/parking/check'?'check':url.pathname.startsWith('/api/geocoding/')?'geocoding':'other';
   event=kind==='geocoding'?'geocoding.error':'parking.check.error';
   if(!limiter.take(client+':'+kind,kind==='check'?20:60,now()))throw new ApiError(429,'RATE_LIMITED','Trop de demandes. Réessayez dans une minute.');
   if(kind==='check'&&request.method==='POST'){
    if(!(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()==='application/json'))throw new ApiError(415,'CONTENT_TYPE','Une requête JSON est requise.');
    const body=await request.text();if(Buffer.byteLength(body)>8192)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Requête trop volumineuse.');
    let raw:unknown;try{raw=JSON.parse(body);}catch{throw new ApiError(400,'INVALID_JSON','Requête JSON invalide.');}
    const input=validateCheck(raw,now());
    if(!await d.inCity(input))throw new ApiError(422,'OUTSIDE_CITY','JePeuxStationner est actuellement disponible en version bêta à Lyon. D’autres villes arrivent bientôt.');
    const result=await d.check(input,new Date(now()).toISOString());
    if(result.failure)throw new ApiError(503,'SERVICE_UNAVAILABLE','Impossible de vérifier les règles pour le moment. Réessayez dans quelques instants.');
    status=200;event=result.decision.status==='UNKNOWN'?'parking.check.unknown':'parking.check.success';return json(result);
   }
   if(url.pathname==='/api/geocoding/autocomplete'&&request.method==='GET'){
    const q=url.searchParams.get('q')??'';
    if(q.trim().length<3||q.length>200)throw new ApiError(400,'INVALID_QUERY','Saisissez entre 3 et 200 caractères.');
    const suggestions=await d.geocoder.autocomplete(q,{limit:5,signal:request.signal});
    status=200;event='geocoding.success';return json({suggestions:suggestions.slice(0,5)});
   }
   if(url.pathname==='/api/geocoding/reverse'&&request.method==='GET'){
    const p=queryCoordinates(url.searchParams),location=await d.geocoder.reverse(p.latitude,p.longitude,{signal:request.signal});
    status=200;event='geocoding.success';return json({location});
   }
   throw new ApiError(404,'NOT_FOUND','Ressource introuvable.');
  }catch(e){const error=e instanceof ApiError?e:new ApiError(503,'SERVICE_UNAVAILABLE','Service temporairement indisponible. Réessayez dans quelques instants.');status=error.status;return json({error:{code:error.code,message:error.message}},status,status===429?{'Retry-After':'60'}:{});}
  finally{d.log?.(event,status,Math.round(performance.now()-begun));}
 };
}
