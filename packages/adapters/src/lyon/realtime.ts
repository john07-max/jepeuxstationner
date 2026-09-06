import type { RealtimeObservation } from './facilities.js';
import { fetchOfficialJson } from './facilities.js';
import { FACILITY_REALTIME_URL } from './config.js';
/** Field names must come from a reviewed live response; no guessed default mapping. */
export interface LyonRealtimeMapping { id:string; available:string; updatedAt:string; occupied?:string; evidenceUrl:string }
export function realtimeMapping(raw=process.env['LYON_REALTIME_MAPPING']):LyonRealtimeMapping {
 if(!raw)throw new Error('Realtime schema not verified: LYON_REALTIME_MAPPING required');
 const m=JSON.parse(raw) as LyonRealtimeMapping;
 if(!m||![m.id,m.available,m.updatedAt].every(x=>typeof x==='string'&&/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x))||m.occupied!==undefined&&!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(m.occupied)||typeof m.evidenceUrl!=='string'||!/^https:\/\/(data\.grandlyon\.com|www\.data\.gouv\.fr)\//.test(m.evidenceUrl))throw new Error('Invalid reviewed realtime mapping');
 return m;
}
export function normalizeRealtime(data:unknown,m:LyonRealtimeMapping,now:string):RealtimeObservation[] {
 const d=data as {type?:string;features?:{properties?:Record<string,unknown>}[];numberMatched?:number};
 if(d?.type!=='FeatureCollection'||!Array.isArray(d.features)||d.numberMatched!==d.features.length||!Number.isFinite(Date.parse(now)))throw new Error('Incomplete realtime response');
 const seen=new Set<string>();
 return d.features.map(f=>{
  const p=f.properties,id=p?.[m.id],available=p?.[m.available],updatedAt=p?.[m.updatedAt],occupied=m.occupied?p?.[m.occupied]:undefined;
  if(!p||!(m.available in p)||typeof id!=='string'||!id||seen.has(id)||typeof updatedAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(updatedAt)||!Number.isFinite(Date.parse(updatedAt))||Date.parse(updatedAt)>Date.parse(now))throw new Error('Invalid realtime identity/timestamp');seen.add(id);
  for(const n of [available,occupied])if(n!==undefined&&n!==null&&(!Number.isInteger(n)||Number(n)<0))throw new Error('Invalid realtime count');
  return {externalId:id,updatedAt,...(typeof available==='number'?{availableSpaces:available}:{}),...(typeof occupied==='number'?{occupiedSpaces:occupied}:{})};
 });
}
export async function fetchLyonRealtime(mapping:LyonRealtimeMapping,now:string):Promise<RealtimeObservation[]> {
 return normalizeRealtime(await fetchOfficialJson(FACILITY_REALTIME_URL+'&count=1000'),mapping,now);
}
