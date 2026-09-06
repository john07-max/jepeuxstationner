import type pg from 'pg';
import { readFile } from 'node:fs/promises';
import { coordinates } from '../../domain/src/geocoding.js';
import type { Coordinates } from '../../domain/src/geocoding.js';
import type { Period } from '../../domain/src/index.js';
import type { ParkingFacility, NearbyParkingFacility, ParkingContext } from '../../domain/src/local-parking.js';
import type { StreetMatch } from '../../adapters/src/lyon/streets.js';
import { withRealtime, realtimeMaxAge } from '../../adapters/src/lyon/facilities.js';
import type { RealtimeObservation } from '../../adapters/src/lyon/facilities.js';
import { LYON_ORDER_URL, LYON_REVIEW_UNTIL, LYON_SOURCE,ROADS_URL } from '../../adapters/src/lyon/config.js';
export interface LocalSyncChanges {inserted:number;updated:number;unchanged:number;deactivated:number;invalid:number;dryRun:boolean}
function canonical(v:unknown):string {
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';
 return JSON.stringify(v)??'null';
}
export function facilityBusinessValue(f:ParkingFacility):unknown {
 const {retrievedAt:_retrieved,updatedAt:_updated,...source}=f.source;
 const {lastUpdatedAt:_last,realtime:_realtime,availableSpaces:_available,occupiedSpaces:_occupied,...fields}=f;
 return {...fields,source};
}
export async function syncLyonFacilities(client:pg.Client,facilities:readonly ParkingFacility[],retrievedAt:string,dryRun=false):Promise<LocalSyncChanges> {
 if(!facilities.length||!Number.isFinite(Date.parse(retrievedAt))||facilities.some(f=>f.source.id!=='lyon-facilities')||new Set(facilities.map(f=>f.externalId)).size!==facilities.length)throw new Error('Incomplete/duplicate facility import refused');
 const c:LocalSyncChanges={inserted:0,updated:0,unchanged:0,deactivated:0,invalid:0,dryRun};
 await client.query(dryRun?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
 try{
  if(!dryRun)await client.query("SELECT pg_advisory_xact_lock(hashtext('lyon-facilities'))");
  const old=await client.query("SELECT external_id,normalized,present FROM parking_facilities WHERE source_id='lyon-facilities'");
  const byId=new Map(old.rows.map(r=>[String(r.external_id),r]));
  if(!dryRun)await client.query(`INSERT INTO local_source_registry(id,metadata,retrieved_at) VALUES('lyon-facilities',$1,$2)
   ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata,retrieved_at=EXCLUDED.retrieved_at`,[JSON.stringify(facilities[0]!.source),retrievedAt]);
  for(const f of facilities){
   coordinates(f.coordinates.latitude,f.coordinates.longitude);
   const prior=byId.get(f.externalId),changed=!prior||!prior.present||canonical(facilityBusinessValue(prior.normalized as ParkingFacility))!==canonical(facilityBusinessValue(f));
   if(!prior)c.inserted++;else if(changed)c.updated++;else c.unchanged++;
   if(dryRun)continue;
   if(changed)await client.query(`INSERT INTO parking_facilities(source_id,external_id,position,normalized,retrieved_at)
    VALUES('lyon-facilities',$1,ST_SetSRID(ST_MakePoint($2,$3),4326),$4,$5) ON CONFLICT(source_id,external_id)
    DO UPDATE SET position=EXCLUDED.position,normalized=EXCLUDED.normalized,retrieved_at=EXCLUDED.retrieved_at,present=true`,[f.externalId,f.coordinates.longitude,f.coordinates.latitude,JSON.stringify(f),retrievedAt]);
   else await client.query(`UPDATE parking_facilities SET retrieved_at=$2,normalized=jsonb_set(normalized,'{source}',$3::jsonb)
    WHERE source_id='lyon-facilities' AND external_id=$1 AND (retrieved_at IS DISTINCT FROM $2::timestamptz OR normalized->'source' IS DISTINCT FROM $3::jsonb)`,[f.externalId,retrievedAt,JSON.stringify(f.source)]);
  }
  const ids=facilities.map(f=>f.externalId);c.deactivated=old.rows.filter(r=>r.present&&!ids.includes(String(r.external_id))).length;
  if(!dryRun)await client.query("UPDATE parking_facilities SET present=false WHERE source_id='lyon-facilities' AND present AND NOT(external_id=ANY($1::text[]))",[ids]);
  await client.query(dryRun?'ROLLBACK':'COMMIT');return c;
 }catch(e){await client.query('ROLLBACK');throw e;}
}
export async function syncLyonStreets(client:pg.Client,matches:readonly StreetMatch[],retrievedAt:string,dryRun=false):Promise<LocalSyncChanges> {
 if(!matches.length||!Number.isFinite(Date.parse(retrievedAt))||new Set(matches.map(m=>m.street.externalId)).size!==matches.length)throw new Error('Invalid street import');
 const c:LocalSyncChanges={inserted:0,updated:0,unchanged:0,deactivated:0,invalid:0,dryRun};
 await client.query(dryRun?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
 try{
  if(!dryRun)await client.query("SELECT pg_advisory_xact_lock(hashtext('lyon-streets'))");
  if(!dryRun)for(const source of [LYON_SOURCE,{id:'lyon-roads',url:ROADS_URL,licence:'Licence Ouverte 2.0',version:'grandlyon-roads-audited-2026-09-06',retrievedAt}])await client.query(`INSERT INTO local_source_registry(id,metadata,retrieved_at) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata,retrieved_at=EXCLUDED.retrieved_at`,[source.id,JSON.stringify(source),source.retrievedAt]);
  const old=await client.query('SELECT external_id,normalized,present FROM lyon_street_inventory'),byId=new Map(old.rows.map(r=>[String(r.external_id),r]));
  for(const m of matches){
   const normalized={...m,regulationSource:LYON_SOURCE,roads:[...m.roads].sort((a,b)=>a.id.localeCompare(b.id))};
   const geometry=m.roads.length?{type:'MultiLineString',coordinates:normalized.roads.flatMap(r=>r.geometry.coordinates)}:null;
   if(geometry){const v=await client.query('SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)) AS valid',[JSON.stringify(geometry)]);if(!v.rows[0]?.valid)throw new Error('Invalid official road geometry');}
   const prior=byId.get(m.street.externalId),changed=!prior||!prior.present||canonical(prior.normalized)!==canonical(normalized);
   if(!prior)c.inserted++;else if(changed)c.updated++;else c.unchanged++;
   if(dryRun)continue;
   if(changed)await client.query(`INSERT INTO lyon_street_inventory(external_id,normalized,geometry,eligible,retrieved_at) VALUES($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5)
    ON CONFLICT(external_id) DO UPDATE SET normalized=EXCLUDED.normalized,geometry=EXCLUDED.geometry,eligible=EXCLUDED.eligible,retrieved_at=EXCLUDED.retrieved_at,present=true`,[m.street.externalId,JSON.stringify(normalized),geometry?JSON.stringify(geometry):null,m.eligible,retrievedAt]);
   else await client.query('UPDATE lyon_street_inventory SET retrieved_at=$2 WHERE external_id=$1 AND retrieved_at IS DISTINCT FROM $2::timestamptz',[m.street.externalId,retrievedAt]);
  }
  const ids=matches.map(m=>m.street.externalId);c.deactivated=old.rows.filter(r=>r.present&&!ids.includes(String(r.external_id))).length;
  if(!dryRun)await client.query('UPDATE lyon_street_inventory SET present=false WHERE present AND NOT(external_id=ANY($1::text[]))',[ids]);
  await client.query(dryRun?'ROLLBACK':'COMMIT');return c;
 }catch(e){await client.query('ROLLBACK');throw e;}
}
export async function storeFacilityObservation(client:pg.Client,o:RealtimeObservation):Promise<void> {
 if(!Number.isFinite(Date.parse(o.updatedAt)))throw new Error('Invalid observation timestamp');
 for(const count of [o.availableSpaces,o.occupiedSpaces])if(count!==undefined&&(!Number.isInteger(count)||count<0))throw new Error('Invalid observation count');
 // Out-of-order delivery cannot replace a newer observation.
 await client.query(`UPDATE parking_facilities SET observation=$2::jsonb WHERE source_id='lyon-facilities' AND external_id=$1
  AND (observation IS NULL OR (observation->>'updatedAt')::timestamptz < $3::timestamptz)`,[o.externalId,JSON.stringify(o),o.updatedAt]);
}
export async function findNearbyParkingFacilities(client:Pick<pg.Client,'query'>,position:Coordinates,radius:number,limit:number,now:string,maxAge=realtimeMaxAge()):Promise<NearbyParkingFacility[]> {
 coordinates(position.latitude,position.longitude);
 if(!Number.isFinite(radius)||radius<=0||radius>10000||!Number.isInteger(limit)||limit<1||limit>20)throw new Error('Invalid nearby search bounds');
 const query=await readFile('packages/database/queries/nearby-facilities.sql','utf8');
 const {rows}=await client.query(query,[position.longitude,position.latitude,radius,limit]);
 return rows.map(r=>({...withRealtime(r.normalized as ParkingFacility,(r.observation??undefined) as RealtimeObservation|undefined,now,maxAge),distanceMeters:Number(r.distance_meters)}));
}
export async function resolveLyonContext(client:Pick<pg.Client,'query'>,position:Coordinates,period:Period,now:string):Promise<ParkingContext|undefined> {
 coordinates(position.latitude,position.longitude);
 const {rows}=await client.query(`SELECT z.id,z.city_id,z.curb_side,v.evidence_url,v.regime,v.verified_at,v.fresh_until,
   s.eligible,s.present,s.retrieved_at
  FROM parking_zones z LEFT JOIN lyon_verified_spaces v ON v.zone_id=z.id LEFT JOIN lyon_street_inventory s ON s.external_id=v.street_id
  JOIN cities c ON c.id=z.city_id
  WHERE z.city_id='lyon' AND ST_Covers(z.area,ST_SetSRID(ST_MakePoint($1,$2),4326))
   AND ST_Covers(c.boundary,ST_SetSRID(ST_MakePoint($1,$2),4326))`,[position.longitude,position.latitude]);
 if(rows.length!==1)return undefined;
 const r=rows[0]!;
 if(!r.evidence_url||r.curb_side==='UNKNOWN'||!r.eligible||!r.present||r.regime!=='UNO'||!(Date.parse(r.verified_at)<=Date.parse(now))||!(Date.parse(now)<Date.parse(r.fresh_until))||Date.parse(r.retrieved_at)>Date.parse(now)||Date.parse(now)-Date.parse(r.retrieved_at)>=7*86400000)return undefined;
 const freshUntil=new Date(Math.min(Date.parse(LYON_REVIEW_UNTIL),Date.parse(r.fresh_until),Date.parse(r.retrieved_at)+7*86400000)).toISOString();
 return {query:{...period,cityId:'lyon',zoneId:String(r.id)},coverage:{cityId:'lyon',zoneId:String(r.id),status:'DOCUMENTED',markedSpaceVerified:true,ambiguous:false,regime:'UNO',
  source:{id:'lyon-uno',adapterId:'lyon-parking',reference:LYON_ORDER_URL+' ; '+String(r.evidence_url),version:LYON_SOURCE.version,authority:'OFFICIAL',kind:'ORDER',synthetic:false,observedAt:LYON_SOURCE.retrievedAt,freshUntil,notice:'Emplacement documenté ; vérifier la signalisation sur place.'}}};
}
