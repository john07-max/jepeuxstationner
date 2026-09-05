import { readFile } from 'node:fs/promises';
import type { Client } from 'pg';
import type { ParkingQuery, ParkingRule, RuleSnapshot, SourceEvidence } from '../../domain/src/index.js';
// Validation bridge, not a real-world data provider or address geocoder.
// npm commands run from the repository root; SQL files remain the source of truth.
const sql = async (name: string): Promise<string> => readFile(`packages/database/queries/${name}.sql`,'utf8');
interface EvidenceRow {
 source_id:string; adapter_id:string; authority:SourceEvidence['authority']; kind:SourceEvidence['kind'];
 reference:string; version:string; synthetic:boolean; observed_at:Date; fresh_until:Date;
}
interface CoverageRow extends EvidenceRow { complete:boolean; period_start:Date; period_end:Date }
interface RuleRow extends EvidenceRow {
 id:string; city_id:string; zone_id:string; effect:ParkingRule['effect']; conditions:string[];
 period_start:Date; period_end:Date;
}
function evidence(r:EvidenceRow):SourceEvidence {
 return {id:r.source_id,adapterId:r.adapter_id,authority:r.authority,kind:r.kind,
 reference:r.reference,version:r.version,synthetic:r.synthetic,
 observedAt:r.observed_at.toISOString(),freshUntil:r.fresh_until.toISOString()};
}
export async function resolveZone(client:Client, longitude:number, latitude:number, cityId:string):Promise<
 {zoneId:string|null; reason:'RESOLVED'|'INVALID_COORDINATES'|'NO_ZONE'|'AMBIGUOUS_ZONE'|'UNKNOWN_CURB'}> {
 if (!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90) return {zoneId:null,reason:'INVALID_COORDINATES'};
 const {rows}=await client.query<{id:string;curb_side:string}>(await sql('resolve-zone'),[longitude,latitude,cityId]);
 if (!rows.length) return {zoneId:null,reason:'NO_ZONE'};
 if (rows.length!==1) return {zoneId:null,reason:'AMBIGUOUS_ZONE'};
 const zone=rows[0]!;
 if (zone.curb_side==='UNKNOWN') return {zoneId:null,reason:'UNKNOWN_CURB'};
 return {zoneId:zone.id,reason:'RESOLVED'};
}
export async function readSnapshots(client:Client, q:ParkingQuery):Promise<RuleSnapshot[]> {
 const values=[q.cityId,q.zoneId,q.start,q.end];
 const {rows:coverage}=await client.query<CoverageRow>(await sql('load-coverage'),values);
 const snapshots:RuleSnapshot[]=[];
 for (const c of coverage) {
  const {rows}=await client.query<RuleRow>(await sql('load-rules'),[...values,c.adapter_id]);
  snapshots.push({adapterId:c.adapter_id,cityId:q.cityId,zoneId:q.zoneId,complete:c.complete,
   start:c.period_start.toISOString(),end:c.period_end.toISOString(),coverageSource:evidence(c),
   rules:rows.map(r=>({id:r.id,cityId:r.city_id,zoneId:r.zone_id,effect:r.effect,conditions:r.conditions,
    start:r.period_start.toISOString(),end:r.period_end.toISOString(),source:evidence(r)}))});
 }
 return snapshots;
}
