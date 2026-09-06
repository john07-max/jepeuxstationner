import type pg from 'pg';
import { dialogBusinessFingerprint } from './dialog-fingerprint.js';
import { readFile } from 'node:fs/promises';
import type { ImportedParkingRule } from '../../domain/src/imported-rule.js';
import type { ParkingQuery } from '../../domain/src/index.js';
import { DiaLogDataSourceAdapter } from '../../adapters/src/dialog/adapter.js';
import type { ParsedDiaLog } from '../../adapters/src/dialog/parser.js';
import { DIALOG_ENDPOINT, DiaLogError } from '../../adapters/src/dialog/types.js';
export interface SyncChanges {inserted:number;updated:number;deactivated:number;invalid:number;durationMs:number;dryRun:boolean;}
export async function syncDiaLog(client:pg.Client, parsed:ParsedDiaLog, retrievedAt:string, dryRun=false):Promise<SyncChanges> {
 const began=performance.now();const changes:SyncChanges={inserted:0,updated:0,deactivated:0,invalid:0,durationMs:0,dryRun};
 if(!Number.isFinite(Date.parse(retrievedAt)) || parsed.stats.invalid/Math.max(parsed.stats.fetched,1)>0.01)throw new DiaLogError('QUALITY');
 await client.query(dryRun?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
 try {
  if(!dryRun)await client.query("SELECT pg_advisory_xact_lock(hashtext('dialog-sync'))");
  const seen=new Set<string>();const valid:ImportedParkingRule[]=[];
  for(const rule of parsed.rules) {
   if(seen.has(rule.externalId))continue;seen.add(rule.externalId);
   const check=await client.query('SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)) AS valid',[JSON.stringify(rule.geometry)]);
   if(!check.rows[0]?.valid){changes.invalid++;continue;}valid.push(rule);
  }
  if(changes.invalid/Math.max(parsed.stats.accepted,1)>0.01)throw new DiaLogError('QUALITY');
  const old=await client.query("SELECT external_id,normalized,present FROM imported_parking_rules WHERE source_id='dialog'");
  const existing=new Map(old.rows.map(r=>[String(r.external_id),r]));
  const businessChanges=new Set<string>();
  for(const r of valid){
   const prior=existing.get(r.externalId);
   if(!prior){changes.inserted++;businessChanges.add(r.externalId);}
   else if(!prior.present||dialogBusinessFingerprint(prior.normalized as ImportedParkingRule)!==dialogBusinessFingerprint(r)){
    changes.updated++;businessChanges.add(r.externalId);
   }
  }
  // Any rejected entry disables disappearance processing: never deactivate a record we failed to decode.
  const allowDeactivate=parsed.stats.invalid===0&&changes.invalid===0&&parsed.stats.fetched>0;
  changes.deactivated=allowDeactivate?old.rows.filter(r=>r.present&&!seen.has(String(r.external_id))).length:0;
  if(!dryRun) {
   await client.query(`INSERT INTO data_sources(id,adapter_id,authority,kind,reference,version,synthetic,observed_at,fresh_until)
    VALUES('dialog','dialog','OFFICIAL','DATASET',$1,'3',false,$2,$3)
    ON CONFLICT(id) DO UPDATE SET observed_at=EXCLUDED.observed_at,fresh_until=EXCLUDED.fresh_until`,[DIALOG_ENDPOINT,retrievedAt,valid[0]?.source.freshUntil??new Date(Date.parse(retrievedAt)+86400000).toISOString()]);
   for(const r of valid) {
    if(!businessChanges.has(r.externalId)) {
     // Only refresh observation evidence; never rewrite geometry, period or business payload.
     const freshness={observedAt:r.source.observedAt,retrievedAt:r.source.retrievedAt,freshUntil:r.source.freshUntil,sourceUpdatedAt:r.source.sourceUpdatedAt};
     await client.query(`UPDATE imported_parking_rules SET retrieved_at=$2,
      normalized=jsonb_set(normalized,'{source}',((normalized->'source') - 'observedAt' - 'retrievedAt' - 'freshUntil' - 'sourceUpdatedAt') || $3::jsonb)
      WHERE source_id='dialog' AND external_id=$1 AND
       (retrieved_at IS DISTINCT FROM $2::timestamptz OR normalized->'source' IS DISTINCT FROM
        (((normalized->'source') - 'observedAt' - 'retrievedAt' - 'freshUntil' - 'sourceUpdatedAt') || $3::jsonb))`,
      [r.externalId,retrievedAt,JSON.stringify(freshness)]);
     continue;
    }
    await client.query(`INSERT INTO imported_parking_rules(source_id,external_id,geometry,valid_during,active,supported,retrieved_at,normalized)
    VALUES('dialog',$1,ST_SetSRID(ST_GeomFromGeoJSON($2),4326),tstzrange($3::timestamptz,$4::timestamptz,'[)'),$5,$6,$7,$8)
    ON CONFLICT(source_id,external_id) DO UPDATE SET geometry=EXCLUDED.geometry,valid_during=EXCLUDED.valid_during,active=EXCLUDED.active,supported=EXCLUDED.supported,retrieved_at=EXCLUDED.retrieved_at,normalized=EXCLUDED.normalized,present=true`,
    [r.externalId,JSON.stringify(r.geometry),r.start,r.end,r.active,r.supported,retrievedAt,JSON.stringify(r)]);
   }
   if(allowDeactivate)await client.query("UPDATE imported_parking_rules SET present=false WHERE source_id='dialog' AND present AND NOT(external_id=ANY($1::text[]))",[[...seen]]);
  }
  await client.query(dryRun?'ROLLBACK':'COMMIT');changes.durationMs=performance.now()-began;return changes;
 }catch(e){await client.query('ROLLBACK');throw e;}
}
export function databaseDiaLogAdapter(client:pg.Client, longitude:number, latitude:number, toleranceMeters=Number(process.env['DIALOG_SPATIAL_TOLERANCE_METERS']??5)):DiaLogDataSourceAdapter {
 if(!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(toleranceMeters)||toleranceMeters<0||toleranceMeters>15)throw new DiaLogError('CONFIG');
 return new DiaLogDataSourceAdapter(async(query:ParkingQuery,signal?:AbortSignal)=>{
  signal?.throwIfAborted();
  // Existing city boundary scopes this national inventory to the configured MVP city.
  const city=await client.query('SELECT id FROM cities WHERE id=$1 AND ST_Covers(boundary,ST_SetSRID(ST_MakePoint($2,$3),4326))',[query.cityId,longitude,latitude]);
  if(!city.rowCount)throw new DiaLogError('CONFIG');
  const zone=await client.query('SELECT id,curb_side FROM parking_zones WHERE city_id=$1 AND ST_Covers(area,ST_SetSRID(ST_MakePoint($2,$3),4326))',[query.cityId,longitude,latitude]);
  if(zone.rowCount!==1 || zone.rows[0]?.id!==query.zoneId || zone.rows[0]?.curb_side==='UNKNOWN')throw new DiaLogError('CONFIG');
  const latest=await client.query("SELECT observed_at,fresh_until FROM data_sources WHERE id='dialog'");if(!latest.rows[0])throw new DiaLogError('INVALID');
  const rows=await client.query(await readFile('packages/database/queries/dialog-at-position.sql','utf8'),[longitude,latitude,query.start,query.end,toleranceMeters]);
  signal?.throwIfAborted();return {retrievedAt:(latest.rows[0].observed_at as Date).toISOString(),freshUntil:(latest.rows[0].fresh_until as Date).toISOString(),rules:rows.rows.map(r=>r.normalized as ImportedParkingRule)};
 });
}
