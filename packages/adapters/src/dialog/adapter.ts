import type { DataSourceAdapter, ParkingQuery, RuleSnapshot, SourceEvidence } from '../../../domain/src/index.js';
import type { ImportedParkingRule } from '../../../domain/src/imported-rule.js';
import { DiaLogError, DIALOG_NOTICE, DIALOG_ENDPOINT } from './types.js';
export interface DiaLogReadResult {rules:ImportedParkingRule[];retrievedAt:string;freshUntil?:string;}
/** The injected repository performs real PostGIS selection; no national download per user request. */
export class DiaLogDataSourceAdapter implements DataSourceAdapter {
 readonly id='dialog';
 constructor(private readonly read:(query:ParkingQuery,signal?:AbortSignal)=>Promise<DiaLogReadResult>,private readonly freshnessMs=86400000){}
 async load(query:ParkingQuery,signal?:AbortSignal):Promise<RuleSnapshot> {
  const {rules,retrievedAt,freshUntil}=await this.read(query,signal);
  if(rules.some(r=>!r.supported))throw new DiaLogError('INVALID');
  const source:SourceEvidence={id:'dialog',adapterId:this.id,reference:DIALOG_ENDPOINT,version:'3',authority:'OFFICIAL',legalAuthority:'informative',notice:DIALOG_NOTICE,kind:'DATASET',synthetic:false,observedAt:retrievedAt,retrievedAt,freshUntil:freshUntil??new Date(Date.parse(retrievedAt)+this.freshnessMs).toISOString()};
  return {...query,adapterId:this.id,complete:false,purpose:'RESTRICTIONS',coverageSource:source,
   rules:rules.filter(r=>r.active && Date.parse(r.start)<Date.parse(query.end)&&(!r.end||Date.parse(r.end)>Date.parse(query.start))).map(r=>({...r,cityId:query.cityId,zoneId:query.zoneId,start:new Date(Math.max(Date.parse(r.start),Date.parse(query.start))).toISOString(),end:new Date(Math.min(r.end?Date.parse(r.end):Infinity,Date.parse(query.end))).toISOString()}))};
 }
}
