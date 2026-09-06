import { coordinates } from '../../../domain/src/geocoding.js';
import type { ParkingFacility, SourceRecord } from '../../../domain/src/local-parking.js';
import { FACILITY_STATIC_URL,FACILITY_REALTIME_URL } from './config.js';
export const DEFAULT_REALTIME_MAX_AGE=180; // seconds; three announced one-minute LPA cycles, not a guarantee for other operators.
export interface RealtimeObservation { externalId:string; availableSpaces?:number; occupiedSpaces?:number; updatedAt:string }
export function realtimeMaxAge(value=process.env['PARKING_REALTIME_MAX_AGE']):number {
 const n=Number(value??DEFAULT_REALTIME_MAX_AGE);if(!Number.isInteger(n)||n<60||n>900)throw new Error('PARKING_REALTIME_MAX_AGE must be 60..900 seconds');return n;
}
export function withRealtime(f:ParkingFacility,observation:RealtimeObservation|undefined,now:string,maxAge=DEFAULT_REALTIME_MAX_AGE):ParkingFacility {
 if(!Number.isFinite(Date.parse(now))||!Number.isInteger(maxAge)||maxAge<60||maxAge>900)throw new Error('Invalid freshness configuration');
 const {availableSpaces:_available,occupiedSpaces:_occupied,...base}=f;
 const validCount=(n:number|undefined)=>n===undefined||Number.isInteger(n)&&n>=0&&(f.capacity===undefined||n<=f.capacity);
 const valid=observation&&observation.externalId===f.externalId&&Number.isFinite(Date.parse(observation.updatedAt))&&Date.parse(now)>=Date.parse(observation.updatedAt)&&Date.parse(now)-Date.parse(observation.updatedAt)<maxAge*1000&&validCount(observation.availableSpaces)&&validCount(observation.occupiedSpaces)&&
  (observation.availableSpaces!==undefined||observation.occupiedSpaces!==undefined)&&
  (f.capacity===undefined||observation.availableSpaces===undefined||observation.occupiedSpaces===undefined||observation.availableSpaces+observation.occupiedSpaces<=f.capacity);
 if(!valid)return {...base,realtime:'UNKNOWN',...(observation?{lastUpdatedAt:observation.updatedAt}:{})};
 return {...base,realtime:'AVAILABLE',realtimeSourceUrl:FACILITY_REALTIME_URL,lastUpdatedAt:observation.updatedAt,...(observation.availableSpaces===undefined?{}:{availableSpaces:observation.availableSpaces}),...(observation.occupiedSpaces===undefined?{}:{occupiedSpaces:observation.occupiedSpaces})};
}
function text(v:unknown):string|undefined {return typeof v==='string'&&v.trim()?v.trim():undefined;}
export class LyonParkingFacilityAdapter {
 readonly id='lyon-facilities';
 normalize(data:unknown,retrievedAt:string):ParkingFacility[] {
  const d=data as {type?:string;features?:{geometry?:{type?:string;coordinates?:number[]};properties?:Record<string,unknown>}[];numberMatched?:number;crs?:{properties?:{name?:string}}};
  if(!Number.isFinite(Date.parse(retrievedAt))||d?.type!=='FeatureCollection'||!Array.isArray(d.features)||d.numberMatched!==d.features.length||d.crs?.properties?.name&&!d.crs.properties.name.endsWith('4326'))throw new Error('Incomplete or non-WGS84 facility collection');
  const seen=new Set<string>();
  return d.features.map(f=>{
   const p=f.properties,xy=f.geometry?.coordinates;
   if(!p||!text(p['id'])||!text(p['nom'])||f.geometry?.type!=='Point'||xy?.length!==2)throw new Error('Invalid facility');
   if(text(p['last_update'])&&!Number.isFinite(Date.parse(String(p['last_update']))))throw new Error('Invalid source update timestamp');
   const externalId=String(p['id']);if(seen.has(externalId))throw new Error('Duplicate facility');seen.add(externalId);
   const source:SourceRecord={id:this.id,url:FACILITY_STATIC_URL,licence:'Licence Ouverte 2.0',version:'grandlyon-static-audited-2026-09-06',retrievedAt,...(text(p['last_update'])?{updatedAt:String(p['last_update'])}:{})};
   const capacity=p['nb_places'];if(capacity!==null&&capacity!==undefined&&!Number.isInteger(capacity))throw new Error('Invalid capacity');
   const tariffs:Record<string,number>={};for(const h of [1,2,3,4,24]){const v=p[`tarif_${h}h`];if(typeof v==='number'&&Number.isFinite(v)&&v>=0)tariffs[String(h)]=v;}
   const url=text(p['url']);
   return {id:`${this.id}:${externalId}`,externalId,source,name:String(p['nom']),coordinates:coordinates(xy[1]!,xy[0]!),
    ...(text(p['adresse'])?{address:String(p['adresse'])}:{}),...(typeof capacity==='number'&&capacity>=0?{capacity}:{}),
    publicAccess:p['type_usagers']==='tous',realtime:'UNKNOWN',sourceUrl:url&&/^https?:\/\//.test(url)?url:FACILITY_STATIC_URL,
    pricing:{status:p['gratuit']===true?'FREE':p['gratuit']===false?'PAID':'UNKNOWN',explanation:'Tarif parking publié ; conditions et ouverture à vérifier auprès de l’opérateur.'},
    ...(Object.keys(tariffs).length?{hourlyTariffs:tariffs}:{}),...(source.updatedAt?{lastUpdatedAt:source.updatedAt}:{})};
  });
 }
 async fetch(signal?:AbortSignal):Promise<ParkingFacility[]> {
  const data=await fetchOfficialJson(FACILITY_STATIC_URL+'&count=1000',signal);
  return this.normalize(data,new Date().toISOString());
 }
}
export async function fetchOfficialJson(url:string,signal?:AbortSignal):Promise<unknown> {
 const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='data.grandlyon.com')throw new Error('Unexpected source host');
 const timeout=AbortSignal.timeout(30000);const response=await fetch(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,redirect:'error',headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error(`Grand Lyon HTTP ${response.status}`);
 const reader=response.body?.getReader();if(!reader)throw new Error('Missing response body');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>12000000)throw new Error('Source exceeds 12 MB limit');chunks.push(r.value);}}finally{await reader.cancel();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
