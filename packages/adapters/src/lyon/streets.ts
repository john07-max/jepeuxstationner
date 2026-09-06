import type { CityCoverageReport } from '../../../domain/src/local-parking.js';
export interface OfficialStreet { externalId:string; arrondissement:number; name:string; regulation:string; extension:string; page:number }
export interface RoadGeometry { type:'MultiLineString'; coordinates:number[][][] }
export interface Road { id:string; streetId:string; arrondissement:number; name:string; geometry:RoadGeometry }
export interface StreetMatch { street:OfficialStreet; status:'matched'|'ambiguous'|'unmatched'; roads:Road[]; eligible:boolean; reason:string }
export function normalizeStreetName(name:string):string {
 return name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’‘`]/gu,"'").replace(/[’'\-.,]/gu,' ')
  .replace(/^bd\s/u,'boulevard ').replace(/^av\s/u,'avenue ').replace(/^pl\s/u,'place ').replace(/^r\s/u,'rue ').replace(/\bst\b/gu,'saint').replace(/\bste\b/gu,'sainte').replace(/\s+/gu,' ').trim();
}
export function matchStreets(streets:readonly OfficialStreet[],roads:readonly Road[],asOf:string):{matches:StreetMatch[];report:CityCoverageReport} {
 const byName=new Map<string,Road[]>();
 for(const r of roads){const key=r.arrondissement+':'+normalizeStreetName(r.name);byName.set(key,[...(byName.get(key)??[]),r]);}
 const matches=streets.map(street=>{
  const candidates=byName.get(street.arrondissement+':'+normalizeStreetName(street.name))??[];
  const ids=new Set(candidates.map(r=>r.streetId));
  const status=ids.size===1?'matched' as const:ids.size>1?'ambiguous' as const:'unmatched' as const;
  const extension=street.extension ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(street.extension):null;
  const extensionOk=!street.extension || (extension!==null&&`${extension[3]}-${extension[2]}-${extension[1]}`<=asOf.slice(0,10));
  const eligible=status==='matched'&&street.regulation.toLowerCase()==='complet'&&extensionOk&&!normalizeStreetName(street.name).includes('neyret');
  return {street,status,roads:status==='matched'?candidates:[],eligible,reason:eligible?'AXIS_MATCH_ONLY_NOT_A_PARKING_SPACE':status!=='matched'?status:'PARTIAL_OR_UNSUPPORTED_REGULATION'};
 });
 const matched=matches.filter(m=>m.status==='matched').length,ambiguous=matches.filter(m=>m.status==='ambiguous').length;
 return {matches,report:{officialStreets:streets.length,matched,ambiguous,unmatched:streets.length-matched-ambiguous,coveragePercent:streets.length?Math.round(matched/streets.length*10000)/100:0,verifiedParkingSpaces:0}};
}
export function parseRoads(data:unknown):Road[] {
 const collection=data as {type?:string;features?:{properties:Record<string,unknown>;geometry:RoadGeometry}[];numberMatched?:number};
 if(collection.type!=='FeatureCollection'||!Array.isArray(collection.features)||collection.numberMatched!==collection.features.length)throw new Error('Incomplete road collection');
 return collection.features.map(f=>{
  const p=f.properties;
  if(typeof p['codeinsee']!=='string'||!/^6938[1-9]$/.test(p['codeinsee'])||typeof p['nom']!=='string'||typeof p['codefuv']!=='string'||typeof p['codetroncon']!=='string'||f.geometry?.type!=='MultiLineString'||!f.geometry.coordinates.length||f.geometry.coordinates.some(line=>line.length<2||line.some(x=>x.length!==2||!Number.isFinite(x[0])||!Number.isFinite(x[1])||Math.abs(x[0]!)>180||Math.abs(x[1]!)>90)))throw new Error('Invalid road record');
  return {id:p['codetroncon'],streetId:p['codefuv'],arrondissement:Number(p['codeinsee'].slice(-1)),name:p['nom'],geometry:f.geometry};
 });
}
