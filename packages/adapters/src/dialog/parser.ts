import sax from 'sax';
import { createHash } from 'node:crypto';
import type { ImportedParkingRule, RuleGeometry, Position } from '../../../domain/src/imported-rule.js';
import { instant } from '../../../engine/src/index.js';
import { DiaLogError, DIALOG_NOTICE, DIALOG_ENDPOINT, silentMetric } from './types.js';
import type { Metric, ParseStats } from './types.js';
const TR='http://datex2.eu/schema/3/trafficRegulation', COM='http://datex2.eu/schema/3/common';
const DX='https://raw.githubusercontent.com/MTES-MCT/dialog/main/docs/spec/datex2';
interface Node { name:string; uri:string; type:string; attrs:Record<string,string>; text:string; children:Node[]; }
const children=(n:Node,name:string,uri=TR)=>n.children.filter(c=>c.name===name && c.uri===uri);
const all=(n:Node,name:string,uri=COM):Node[]=>[...(n.name===name && n.uri===uri?[n]:[]),...n.children.flatMap(c=>all(c,name,uri))];
const types=(n:Node,type:string):Node[]=>[...(n.type===type?[n]:[]),...n.children.flatMap(c=>types(c,type))];
const txt=(n:Node,name:string,uri=COM)=>all(n,name,uri)[0]?.text.trim()??'';
function position(p:unknown):asserts p is Position {
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0] as number)>180||Math.abs(p[1] as number)>90) throw new DiaLogError('INVALID');
}
export function geometry(value:unknown):RuleGeometry {
 if(!value||typeof value!=='object'||!('type' in value)||!('coordinates' in value)) throw new DiaLogError('INVALID');
 const {type,coordinates:c}=value;
 const line=(v:unknown,min=2)=>{if(!Array.isArray(v)||v.length<min)throw new DiaLogError('INVALID');v.forEach(position);};
 const polygon=(v:unknown)=>{if(!Array.isArray(v)||!v.length)throw new DiaLogError('INVALID');for(const r of v){line(r,4);if(JSON.stringify(r[0])!==JSON.stringify(r.at(-1)))throw new DiaLogError('INVALID');}};
 if(type==='Point')position(c);else if(type==='LineString')line(c);else if(type==='Polygon')polygon(c);
 else if(type==='MultiPolygon'){if(!Array.isArray(c)||!c.length)throw new DiaLogError('INVALID');c.forEach(polygon);}else throw new DiaLogError('INVALID');
 return {type,coordinates:c} as RuleGeometry;
}
export function geometries(value:unknown, depth=0):RuleGeometry[] {
 if(depth>8||!value||typeof value!=='object'||!('type' in value))throw new DiaLogError('INVALID');
 if(value.type==='GeometryCollection' && 'geometries' in value && Array.isArray(value.geometries) && value.geometries.length) return value.geometries.flatMap(v=>geometries(v,depth+1));
 if((value.type==='MultiLineString'||value.type==='MultiPoint')&&'coordinates' in value&&Array.isArray(value.coordinates)&&value.coordinates.length) return value.coordinates.map(c=>geometry({type:value.type==='MultiLineString'?'LineString':'Point',coordinates:c}));
 return [geometry(value)];
}
function date(t:string):string {if(!Number.isFinite(instant(t)))throw new DiaLogError('INVALID');return new Date(t).toISOString();}
function normalize(order:Node, retrievedAt:string, freshnessMs:number):{rules:ImportedParkingRule[];ignored:number} {
 const id=order.attrs['id'];if(!id)throw new DiaLogError('INVALID');
 const rules:ImportedParkingRule[]=[];let ignored=0;
 for(const measure of children(order,'trafficRegulation')) {
  const kind=children(measure,'typeOfRegulation')[0];
  if(!kind || kind.type!=='StandingOrParkingRestriction'||txt(kind,'standingOrParkingRestrictionType',TR)!=='parkingProhibited'){ignored++;continue;}
  const validity=types(measure,'ValidityCondition');
  const periods=validity.length?validity:children(order,'validityByOrder');
  const locations=types(measure,'LocationCondition');
  if(!periods.length||!locations.length)throw new DiaLogError('INVALID');
  const recurrence=[...all(measure,'recurringTimePeriodOfDay'),...all(measure,'recurringDayWeekMonthPeriod')].map(n=>JSON.stringify(n));
  const vehicles=['VehicleCondition','DriverCondition','AccessCondition','NonVehicularRoadUserCondition'].flatMap(t=>types(measure,t)).map(n=>JSON.stringify(n));
  const conditions=children(measure,'condition');
  const known=new Set(['ConditionSet','ValidityCondition','LocationCondition','VehicleCondition','DriverCondition','AccessCondition','NonVehicularRoadUserCondition']);
  const check=(n:Node):boolean=>(!n.type||known.has(n.type)||n.name==='locationByOrder')&&n.children.every(check);
  // Only the producer's documented AND(validity OR, locations OR, vehicles OR) profile is accepted.
  const tree=conditions[0];
  const groupValid=(n:Node)=>n.type==='ConditionSet' && children(n,'operator').length===1 && children(n,'operator')[0]?.text.trim()==='or' && children(n,'conditions').length>0 && new Set(children(n,'conditions').map(c=>c.type)).size===1 && children(n,'conditions').every(c=>['ValidityCondition','LocationCondition','VehicleCondition','DriverCondition','AccessCondition','NonVehicularRoadUserCondition'].includes(c.type));
  const unsupported=!tree||tree.type!=='ConditionSet'||txt(tree,'operator',TR)!=='and'||!check(tree)||!children(tree,'conditions').every(groupValid)||all(tree,'negate',TR).some(n=>n.text.trim()==='true');
  for(const period of periods)for(const location of locations) {
   const start=date(txt(period,'overallStartTime'));const endText=txt(period,'overallEndTime');const end=endText?date(endText):null;
   if(end && instant(end)<=instant(start))throw new DiaLogError('INVALID');
   for(const geo of geometries(JSON.parse(txt(location,'geoJsonGeometry',DX)) as unknown)) {
   const externalId=id+':'+createHash('sha256').update(JSON.stringify({geo,start,vehicles,recurrence})).digest('hex').slice(0,32);
   // No measure UUID exists in the current XML: content-addressed sub-records, stable order UUID retained.
   const limitations=[...(recurrence.length?['UNSUPPORTED_RECURRENCE']:[]),...(vehicles.length?['UNSUPPORTED_VEHICLE_CONDITION']:[]),...(unsupported?['UNSUPPORTED_CONDITION_TREE']:[])];
   rules.push({id:'dialog:'+externalId,externalId,effect:'FORBIDDEN',conditions:[],start,end,geometry:geo,permanent:end===null,
    active:children(order,'status')[0]?.text.trim()==='madeAndImplemented' && txt(measure,'status',TR)==='active' && (!end || instant(end)>instant(retrievedAt)),supported:limitations.length===0,limitations,recurrence,vehicleConditions:vehicles,
    orderReference:txt(order,'regulationId',TR),description:txt(children(order,'description')[0]??order,'value'),
    source:{id:'dialog',adapterId:'dialog',reference:txt(order,'publicUrl',DX)||DIALOG_ENDPOINT,version:order.attrs['version']??'1',authority:'OFFICIAL',legalAuthority:'informative',notice:DIALOG_NOTICE,kind:'DATASET',synthetic:false,
     observedAt:retrievedAt,retrievedAt,freshUntil:new Date(instant(retrievedAt)+freshnessMs).toISOString()}});
   }
  }
 }
 return {rules,ignored};
}
export interface ParsedDiaLog { rules:ImportedParkingRule[];stats:ParseStats; }
export async function parseDiaLog(chunks:AsyncIterable<Uint8Array|string>, retrievedAt:string, options:{maxBytes?:number;freshnessMs?:number;metric?:Metric}={}):Promise<ParsedDiaLog> {
 date(retrievedAt);const began=performance.now(),metric=options.metric??silentMetric;
 const maxBytes=options.maxBytes??128*1024*1024,freshnessMs=options.freshnessMs??86400000;
 if(!Number.isFinite(maxBytes)||maxBytes<=0||!Number.isFinite(freshnessMs)||freshnessMs<=0)throw new DiaLogError('CONFIG');
 const stats:ParseStats={fetched:0,parsed:0,accepted:0,ignored:0,invalid:0,bytes:0,durationMs:0};
 const rules:ImportedParkingRule[]=[];const ids=new Map<string,ImportedParkingRule>();const stack:Node[]=[];
 let root=false,depth=0,orderNodes=0,orderChars=0;
 const parser=sax.parser(true,{xmlns:true,...{strictEntities:true}});
 parser.onerror=()=>{throw new DiaLogError('XML');};parser.ondoctype=()=>{throw new DiaLogError('XML');};parser.onsgmldeclaration=()=>{throw new DiaLogError('XML');};
 parser.onopentag=tag=>{
  const t=tag as sax.QualifiedTag;depth++;if(depth>64)throw new DiaLogError('LIMIT');
  const attrs=Object.fromEntries(Object.values(t.attributes).map(a=>[a.name,a.value]));
  if(depth===1){if(root||t.local!=='payload'||t.uri!=='http://datex2.eu/schema/3/d2Payload'||attrs['modelBaseVersion']!=='3'||!Object.values(t.attributes).some(a=>a.local==='type'&&a.value.split(':').at(-1)==='TrafficRegulationPublication'))throw new DiaLogError('SCHEMA');root=true;}
  if(stack.length || (t.local==='trafficRegulationOrder'&&t.uri===TR)) {
   if(++orderNodes>50000)throw new DiaLogError('LIMIT');
   const n:Node={name:t.local,uri:t.uri,type:Object.values(t.attributes).find(a=>a.uri==='http://www.w3.org/2001/XMLSchema-instance'&&a.local==='type')?.value.split(':').at(-1)??'',attrs,text:'',children:[]};
   stack.at(-1)?.children.push(n);stack.push(n);
  }
 };
 const text=(t:string)=>{if(stack.length){orderChars+=t.length;if(orderChars>2*1024*1024)throw new DiaLogError('LIMIT');stack.at(-1)!.text+=t;}};
 parser.ontext=text;parser.oncdata=text;
 parser.onclosetag=()=>{
  depth--;const n=stack.pop();if(n && !stack.length){stats.fetched++;try{const result=normalize(n,retrievedAt,freshnessMs);stats.parsed++;stats.ignored+=result.ignored;
   for(const rule of result.rules){const prior=ids.get(rule.externalId);if(prior){if(JSON.stringify(prior)!==JSON.stringify(rule))throw new DiaLogError('QUALITY');continue;}ids.set(rule.externalId,rule);rules.push(rule);stats.accepted++;}
  }catch(e){if(e instanceof DiaLogError&&e.code==='QUALITY')throw e;stats.invalid++;metric('dialog.parse.invalid',1);}orderNodes=0;orderChars=0;}
 };
 const decoder=new TextDecoder('utf-8',{fatal:true});
 try {for await(const chunk of chunks){stats.bytes+=typeof chunk==='string'?Buffer.byteLength(chunk):chunk.byteLength;if(stats.bytes>maxBytes)throw new DiaLogError('LIMIT');parser.write(typeof chunk==='string'?chunk:decoder.decode(chunk,{stream:true}));}parser.write(decoder.decode()).close();}
 catch(e){if(e instanceof DiaLogError)throw e;throw new DiaLogError('XML');}
 if(!root)throw new DiaLogError('SCHEMA');
 if(stats.invalid && stats.invalid/stats.fetched>0.01)throw new DiaLogError('QUALITY');
 stats.durationMs=performance.now()-began;metric('dialog.parse.accepted',stats.accepted);return {rules,stats};
}
