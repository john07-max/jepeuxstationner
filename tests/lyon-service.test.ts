import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CheckParkingService} from '../packages/application/src/check-parking.js';
import type {CheckParkingDependencies} from '../packages/application/src/check-parking.js';
import {LyonParkingDataSourceAdapter} from '../packages/adapters/src/lyon/adapter.js';
import {LyonParkingPricingEngine} from '../packages/adapters/src/lyon/pricing.js';
import {normalizeRealtime,realtimeMapping} from '../packages/adapters/src/lyon/realtime.js';
const now='2026-09-07T12:00:00Z',period={start:now,end:'2026-09-07T13:00:00Z'};
const location={label:'FICTIONAL',provider:'fixture',coordinates:{latitude:45.76,longitude:4.83},precision:'housenumber' as const};
function dependencies():CheckParkingDependencies {
 const source={id:'fixture',adapterId:'lyon-parking',reference:'fixture://bay',version:'1',authority:'OFFICIAL' as const,kind:'ORDER' as const,synthetic:true,observedAt:'2026-09-06T00:00:00Z',freshUntil:'2026-09-20T00:00:00Z'};
 return {geocoder:{async search(){return [location];},async autocomplete(){return [];},async reverse(){return null;}},
  async resolve(){return {query:{...period,cityId:'lyon',zoneId:'fixture'},coverage:{cityId:'lyon',zoneId:'fixture',status:'DOCUMENTED',markedSpaceVerified:true,ambiguous:false,regime:'UNO',source}};},
  adapters:c=>[new LyonParkingDataSourceAdapter(c.coverage)],pricing:(p,c,v)=>new LyonParkingPricingEngine().evaluate(p,c,v),async nearby(){return [];}};
}
test('Application composes geocoding coverage decision and pricing without persisting address',async()=>{const r=await new CheckParkingService(dependencies()).check('fixture',period,now);assert.equal(r.decision.status,'CONDITIONAL');assert.equal(r.pricing.status,'PAID');assert.equal(r.confidence,'DOCUMENTED');});
test('Ambiguous geocoding never selects the first candidate',async()=>{const d=dependencies();d.geocoder.search=async()=>[location,location];d.resolve=async()=>{throw new Error('must not resolve');};assert.equal((await new CheckParkingService(d).check('fixture',period,now)).decision.status,'UNKNOWN');});
test('Uncovered location never becomes authorized through empty restrictions',async()=>{const d=dependencies();d.resolve=async()=>undefined;assert.equal((await new CheckParkingService(d).check('fixture',period,now)).decision.status,'UNKNOWN');});
test('Geocoding failure sanitized and fail closed',async()=>{const d=dependencies();d.geocoder.search=async()=>{throw new Error('secret address');};const r=await new CheckParkingService(d).check('fixture',period,now);assert.equal(r.decision.status,'UNKNOWN');assert.ok(!JSON.stringify(r).includes('secret'));});
test('Nearby failure preserves prohibition',async()=>{const d=dependencies();d.adapters=c=>[{id:'lyon-parking',async load(){return {...c.query,adapterId:'lyon-parking',complete:true,coverageSource:c.coverage.source,rules:[{...c.query,id:'ban',effect:'FORBIDDEN',conditions:[],source:c.coverage.source}]};}}];d.nearby=async()=>{throw new Error('down');};const r=await new CheckParkingService(d).check('fixture',period,now);assert.equal(r.decision.status,'FORBIDDEN');assert.equal(r.nearbyParkings.length,0);assert.ok(r.warnings.some(w=>w.includes('indisponible')));});
test('Unsupported vehicle profile does not receive car permission',async()=>{assert.equal((await new CheckParkingService(dependencies()).check('fixture',period,now,{vehicleType:'OTHER'})).decision.status,'UNKNOWN');});
const mapping={id:'fixture_id',available:'fixture_available',updatedAt:'fixture_time',evidenceUrl:'https://data.grandlyon.com/fixture-schema'};
const data={type:'FeatureCollection',numberMatched:1,features:[{properties:{fixture_id:'p1',fixture_available:0,fixture_time:now}}]};
test('No unverified realtime mapping guessed',()=>{assert.throws(()=>realtimeMapping(''));assert.deepEqual(realtimeMapping(JSON.stringify(mapping)),mapping);});
test('Reviewed realtime mapping preserves zero free spaces and source time',()=>{const r=normalizeRealtime(data,mapping,now);assert.equal(r[0]?.availableSpaces,0);assert.equal(r[0]?.updatedAt,now);});
test('Realtime schema change, truncated feed and future dates rejected',()=>{assert.throws(()=>normalizeRealtime({...data,numberMatched:2},mapping,now));assert.throws(()=>normalizeRealtime(data,{...mapping,available:'missing'},now));assert.throws(()=>normalizeRealtime(data,mapping,'2026-09-07T11:59:00Z'));});
