import { createHash } from 'node:crypto';
import type { ImportedParkingRule } from '../../domain/src/imported-rule.js';

// Object order is not semantic (PostgreSQL JSONB does not retain it).
// Array order, especially coordinates, remains significant.
function canonical(value:unknown):unknown {
 if(Array.isArray(value))return value.map(canonical);
 if(value!==null && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)]));
 return value;
}
function condition(value:string):unknown {
 try {return JSON.parse(value) as unknown;}catch{return value;}
}
export function dialogBusinessFingerprint(r:ImportedParkingRule):string {
 const s=r.source;
 const business={
  id:r.id,externalId:r.externalId,effect:r.effect,conditions:r.conditions,
  geometry:r.geometry,start:new Date(r.start).toISOString(),end:r.end===null?null:new Date(r.end).toISOString(),
  permanent:r.permanent,active:r.active,supported:r.supported,limitations:r.limitations,
  recurrence:r.recurrence.map(condition),vehicleConditions:r.vehicleConditions.map(condition),
  orderReference:r.orderReference,description:r.description,
  source:{id:s.id,adapterId:s.adapterId,reference:s.reference,version:s.version,authority:s.authority,
   legalAuthority:s.legalAuthority,kind:s.kind,synthetic:s.synthetic,notice:s.notice},
 };
 return createHash('sha256').update(JSON.stringify(canonical(business))).digest('hex');
}
