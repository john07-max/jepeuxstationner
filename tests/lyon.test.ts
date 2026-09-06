import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LyonParkingDataSourceAdapter} from '../packages/adapters/src/lyon/adapter.js';
import {paymentSegments,isFrenchHoliday} from '../packages/adapters/src/lyon/calendar.js';
import {LyonParkingPricingEngine,visitorRateClass} from '../packages/adapters/src/lyon/pricing.js';
import {LyonParkingFacilityAdapter,withRealtime,realtimeMaxAge} from '../packages/adapters/src/lyon/facilities.js';
import {matchStreets,normalizeStreetName,parseRoads} from '../packages/adapters/src/lyon/streets.js';
import type {OfficialStreet,Road} from '../packages/adapters/src/lyon/streets.js';
import type {ParkingCoverage} from '../packages/domain/src/local-parking.js';
import type {ParkingQuery,RuleSnapshot} from '../packages/domain/src/index.js';
import {ParkingDecisionEngine} from '../packages/engine/src/index.js';
const source={id:'test-lyon',adapterId:'lyon-parking',reference:'fixture://lyon-marked-space',version:'1',authority:'OFFICIAL' as const,kind:'ORDER' as const,synthetic:true,observedAt:'2026-09-01T00:00:00Z',freshUntil:'2026-10-01T00:00:00Z'};
export const coverage:ParkingCoverage={cityId:'lyon',zoneId:'fictional-marked-bay',status:'DOCUMENTED',markedSpaceVerified:true,ambiguous:false,regime:'UNO',source};
const query:ParkingQuery={cityId:'lyon',zoneId:coverage.zoneId,start:'2026-09-07T14:00:00+02:00',end:'2026-09-07T15:00:00+02:00'};
const now='2026-09-07T12:00:00Z',engine=new ParkingDecisionEngine(),pricing=new LyonParkingPricingEngine();
async function local(q=query,c=coverage){return new LyonParkingDataSourceAdapter(c).load(q);}
test('Lyon A documented Monday 14h is conditional payment, no invented amount',async()=>{const d=engine.evaluate(query,[await local()],now);assert.equal(d.status,'CONDITIONAL');const p=pricing.evaluate(query,true);assert.equal(p.status,'PAID');assert.equal(p.amount,undefined);});
test('Lyon B documented Sunday is allowed and free',async()=>{const q={...query,start:'2026-09-06T14:00:00+02:00',end:'2026-09-06T15:00:00+02:00'};assert.equal(engine.evaluate(q,[await local(q)],now).status,'ALLOWED');assert.equal(pricing.evaluate(q,true).status,'FREE');});
for(const [label,changes] of [['uncovered',{status:'UNKNOWN'}],['unverified bay',{markedSpaceVerified:false}],['ambiguous',{ambiguous:true}],['nocturne',{regime:'UNSUPPORTED'}]] as const)test(`Lyon ${label} -> UNKNOWN even without DiaLog`,async()=>{assert.equal(engine.evaluate(query,[await local(query,{...coverage,...changes})],now).status,'UNKNOWN');});
test('Lyon stale coverage fails closed',async()=>{assert.equal(engine.evaluate(query,[await local()], '2026-10-02T00:00:00Z').status,'UNKNOWN');});
test('Generic specific ban overrides general permission, future deadline retained',async()=>{
 const q={...query,end:'2026-09-07T18:00:00+02:00'},s=await local(q);
 const rs={...source,id:'restriction',adapterId:'dialog',legalAuthority:'informative' as const};
 const ban:RuleSnapshot={...q,adapterId:'dialog',complete:false,purpose:'RESTRICTIONS',coverageSource:rs,rules:[{...q,id:'ban',start:'2026-09-07T16:00:00+02:00',effect:'FORBIDDEN',conditions:[],source:rs}]};
 const d=engine.evaluate(q,[s,ban],now);assert.equal(d.status,'CONDITIONAL');assert.equal(d.allowedUntil,'2026-09-07T14:00:00.000Z');
 const active={...ban,rules:ban.rules.map(r=>({...r,start:q.start}))};assert.equal(engine.evaluate(q,[s,active],now).status,'FORBIDDEN');
});
test('Specific official contradictions still yield UNKNOWN',async()=>{
 const s=await local();const permission={...s,rules:s.rules.map(r=>{const {scope:_scope,...rest}=r;return rest;})};
 const rs={...source,id:'ban-source',adapterId:'ban'};const ban:RuleSnapshot={...query,adapterId:'ban',complete:true,coverageSource:rs,rules:[{...query,id:'ban',effect:'FORBIDDEN',conditions:[],source:rs}]};
 assert.equal(engine.evaluate(query,[permission,ban],now).status,'UNKNOWN');
});
for(const [name,start,paid] of [
 ['Monday','2026-09-07T14:00:00+02:00',true],['Sunday','2026-09-06T14:00:00+02:00',false],['Easter Monday','2026-04-06T14:00:00+02:00',false],['May 1','2026-05-01T14:00:00+02:00',false],['holiday eve','2026-04-30T14:00:00+02:00',true],['visitor August','2026-08-03T14:00:00+02:00',true],['August 15','2026-08-15T14:00:00+02:00',false],['19h boundary','2026-09-07T19:00:00+02:00',false],['9h boundary','2026-09-07T09:00:00+02:00',true]
] as const)test(`French calendar ${name}`,()=>{assert.equal(paymentSegments({start,end:new Date(Date.parse(start)+3600000).toISOString()})[0]?.paid,paid);});
test('Holiday calculation changes year without a manually fixed list',()=>{assert.ok(isFrenchHoliday('2027-03-29'));assert.equal(isFrenchHoliday('2027-04-06'),false);});
test('Overnight holiday eve becomes free through next morning',()=>{assert.deepEqual(paymentSegments({start:'2026-04-30T18:00:00+02:00',end:'2026-05-01T10:00:00+02:00'}).map(s=>s.paid),[true,false]);});
test('Sunday to Monday crosses midnight and 9h payment boundary',()=>{assert.deepEqual(paymentSegments({start:'2026-09-06T23:00:00+02:00',end:'2026-09-07T10:00:00+02:00'}).map(s=>s.paid),[false,true]);});
test('Paris DST Sunday remains free across clock change',()=>{assert.deepEqual(paymentSegments({start:'2026-03-29T00:00:00+01:00',end:'2026-03-29T10:00:00+02:00'}).map(s=>s.paid),[false]);});
test('Dated eligible exception overrides general payment only during its interval',()=>{const exception={...query,start:'2026-09-07T14:30:00+02:00',paid:false,sourceUrl:'https://www.lyon.fr/fixture-not-production',eligibilityConfirmed:true};assert.deepEqual(paymentSegments(query,[exception]).map(s=>s.paid),[true,false]);assert.deepEqual(paymentSegments(query,[{...exception,eligibilityConfirmed:false}]).map(s=>s.paid),[true]);});
test('Conflicting dated exceptions rejected',()=>{assert.throws(()=>paymentSegments(query,[{...query,paid:false,sourceUrl:'https://www.lyon.fr/a',eligibilityConfirmed:true},{...query,paid:true,sourceUrl:'https://www.lyon.fr/b',eligibilityConfirmed:true}]));});
test('Unsupported long stays fail closed',async()=>{await assert.rejects(()=>local({...query,end:'2026-09-09T14:00:00+02:00'}));});
for(const [energy,weight,expected] of [['THERMAL',1000,'REDUCED'],['THERMAL',1525,'STANDARD'],['THERMAL',1526,'INCREASED'],['PLUGIN_HYBRID',1900,'STANDARD'],['PLUGIN_HYBRID',1901,'INCREASED'],['ELECTRIC',2100,'REDUCED'],['ELECTRIC',2101,'INCREASED']] as const)test(`Visitor class ${energy} ${weight}`,()=>{assert.equal(visitorRateClass({vehicleType:'CAR',energy,weightKg:weight}),expected);});
test('Unknown vehicle never invents class or price',()=>{assert.equal(visitorRateClass({vehicleType:'CAR',weightKg:1200}),undefined);assert.equal(visitorRateClass({vehicleType:'OTHER',energy:'THERMAL',weightKg:1200}),undefined);assert.equal(visitorRateClass({vehicleType:'CAR',energy:'THERMAL',weightKg:-1}),undefined);});
test('Published standard one-hour price, no interpolation at 45 minutes',()=>{const v={vehicleType:'CAR' as const,energy:'THERMAL' as const,weightKg:1200};assert.equal(pricing.evaluate(query,true,v).amount,2);assert.equal(pricing.evaluate({...query,end:'2026-09-07T14:45:00+02:00'},true,v).amount,undefined);});
test('Pricing remains UNKNOWN outside verified coverage',()=>{assert.equal(pricing.evaluate(query,false).status,'UNKNOWN');});
const street:OfficialStreet={externalId:'1:street',arrondissement:1,name:'Boulevard de la Croix-Rousse',regulation:'complet',extension:'',page:1};
const road:Road={id:'T1',streetId:'V1',arrondissement:1,name:'bd. de la Croix Rousse',geometry:{type:'MultiLineString',coordinates:[[[4.8,45.7],[4.81,45.71]]]}};
test('Street normalization accents apostrophes and type variants',()=>{assert.equal(normalizeStreetName('Av. de l’Église'),normalizeStreetName("avenue de l'eglise"));});
test('Multiple segments of one official street id match, no place is certified',()=>{const x=matchStreets([street],[road,{...road,id:'T2'}],now);assert.equal(x.report.matched,1);assert.equal(x.report.verifiedParkingSpaces,0);assert.equal(x.matches[0]?.eligible,true);});
test('Distinct official street identities sharing a name are ambiguous',()=>{assert.equal(matchStreets([street],[road,{...road,streetId:'V2'}],now).report.ambiguous,1);});
test('Different arrondissement is not guessed',()=>{assert.equal(matchStreets([street],[{...road,arrondissement:2}],now).report.unmatched,1);});
test('Partial regulations and future extensions not auto-eligible',()=>{for(const s of [{...street,regulation:'entre deux rues'},{...street,extension:'01/01/2027'}])assert.equal(matchStreets([s],[road],now).matches[0]?.eligible,false);});
test('Controlled annex has 1142 unique entries and quarantines 4 trailing pages',async()=>{const d=JSON.parse(await readFile('data/lyon/streets.json','utf8'));assert.equal(d.streets.length,1142);assert.equal(new Set(d.streets.map((s:OfficialStreet)=>s.externalId)).size,1142);assert.deepEqual(d.quarantinedPages,[63,64,65,66]);assert.match(d.sha256,/^[a-f0-9]{64}$/);assert.ok(d.streets.every((s:OfficialStreet)=>s.page<=62));});
test('Actual official Lyon roads snapshot passes strict schema and completeness',async()=>{assert.equal(parseRoads(JSON.parse(await readFile('data/lyon/roads.geojson','utf8'))).length,7964);});
test('Official static facilities normalize without invented availability or hours',async()=>{const f=new LyonParkingFacilityAdapter().normalize(JSON.parse(await readFile('data/lyon/facilities.geojson','utf8')),now);assert.equal(f.length,189);assert.ok(f.every(x=>x.realtime==='UNKNOWN'&&x.availableSpaces===undefined&&x.openingHours===undefined));const sample=f.find(x=>x.externalId==='69123-P-089')!;assert.equal(sample.name,'LPA Cordeliers');assert.equal(sample.capacity,793);assert.equal(sample.coordinates.longitude,4.837211);});
test('Truncated facility collections are rejected, preventing false deactivation',()=>{assert.throws(()=>new LyonParkingFacilityAdapter().normalize({type:'FeatureCollection',numberMatched:2,features:[]},now));});
test('Freshness threshold, future clocks, invalid counts and unknown values',async()=>{
 const f=new LyonParkingFacilityAdapter().normalize(JSON.parse(await readFile('data/lyon/facilities.geojson','utf8')),now)[0]!;
 const o={externalId:f.externalId,updatedAt:now,availableSpaces:12};
 assert.equal(withRealtime(f,o,now).availableSpaces,12);
 for(const timestamp of ['2026-09-07T12:03:00Z','2026-09-07T11:59:59Z']){const r=withRealtime(f,o,timestamp);assert.equal(r.availableSpaces,undefined);assert.equal(r.realtime,'UNKNOWN');assert.equal(r.id,f.id);}
 assert.equal(withRealtime(f,{...o,availableSpaces:-1},now).realtime,'UNKNOWN');assert.equal(withRealtime(f,undefined,now).realtime,'UNKNOWN');
 assert.throws(()=>realtimeMaxAge('NaN'));assert.throws(()=>realtimeMaxAge('0'));
});
