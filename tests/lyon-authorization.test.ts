import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDiaLog} from '../packages/adapters/src/dialog/parser.js';
import {DiaLogDataSourceAdapter} from '../packages/adapters/src/dialog/adapter.js';
import {LyonParkingDataSourceAdapter} from '../packages/adapters/src/lyon/adapter.js';
import {LyonParkingPricingEngine} from '../packages/adapters/src/lyon/pricing.js';
import {CheckParkingService} from '../packages/application/src/check-parking.js';
import type {Period} from '../packages/domain/src/index.js';
import type {NearbyParkingFacility,ParkingCoverage} from '../packages/domain/src/local-parking.js';
const now='2026-09-07T12:00:00Z',period={start:now,end:'2026-09-07T16:00:00Z'};
const location={label:'FICTIONAL Lyon bay',provider:'fixture',coordinates:{longitude:4.83,latitude:45.76},precision:'housenumber' as const};
const coverage:ParkingCoverage={cityId:'lyon',zoneId:'fixture',status:'DOCUMENTED',markedSpaceVerified:true,ambiguous:false,regime:'UNO',source:{id:'local',adapterId:'lyon-parking',reference:'fixture://marked-bay',version:'1',authority:'OFFICIAL',kind:'ORDER',synthetic:true,observedAt:'2026-09-06T00:00:00Z',freshUntil:'2026-09-20T00:00:00Z'}};
async function parsed(kind:'active'|'future',night=false){let xml=await readFile(`tests/fixtures/lyon/dialog-${kind}.xml`,'utf8');if(night)xml=xml.replaceAll(now,'2026-09-07T20:00:00Z').replaceAll(period.end,'2026-09-07T22:00:00Z');return parseDiaLog((async function*(){yield xml;})(),now);}
async function service(kind:'active'|'future'|'none',night=false){
 const rules=kind==='none'?[]:(await parsed(kind,night)).rules;
 const facilities:NearbyParkingFacility[]=[110,220,330].map((distanceMeters,i)=>({id:`fixture-${i}`,externalId:String(i),source:{id:'fixture',url:'fixture://parking',licence:'synthetic',version:'1',retrievedAt:now},name:'Fictional facility',coordinates:location.coordinates,publicAccess:true,realtime:'UNKNOWN',sourceUrl:'fixture://parking',distanceMeters}));
 let calls=0;
 const app=new CheckParkingService({geocoder:{async search(){return [location];},async autocomplete(){return [];},async reverse(){return null;}},
  async resolve(_p,t){return {query:{...t,cityId:coverage.cityId,zoneId:coverage.zoneId},coverage};},
  adapters:c=>[new LyonParkingDataSourceAdapter(c.coverage),new DiaLogDataSourceAdapter(async()=>({rules,retrievedAt:now}))],
  pricing:(p,c,v)=>new LyonParkingPricingEngine().evaluate(p,c,v),
  async nearby(p,r,l){assert.deepEqual(p,location.coordinates);assert.equal(r,1500);assert.equal(l,3);calls++;return facilities;}});
 return {app,calls:()=>calls};
}
test('Regression: original September 5 XML parsed September 7 is inactive, even after changing dates',async()=>{const xml=await readFile('tests/fixtures/dialog/dialog-parking-active.xml','utf8');const p=await parseDiaLog((async function*(){yield xml;})(),now);assert.equal(p.rules.length,1);assert.equal(p.rules[0]?.active,false);assert.equal({...p.rules[0],start:now,end:period.end}.active,false);});
for(const kind of ['active','future'] as const)test(`Lyon ${kind} XML dates are coherent before parsing and rule reaches adapter`,async()=>{const p=await parsed(kind);assert.equal(p.rules.length,1);assert.equal(p.rules[0]?.active,true);assert.equal(p.rules[0]?.supported,true);assert.equal(p.rules[0]?.start,new Date(kind==='active'?now:'2026-09-07T14:00:00Z').toISOString());assert.equal(p.rules[0]?.end,new Date(period.end).toISOString());const s=await new DiaLogDataSourceAdapter(async()=>({rules:p.rules,retrievedAt:now})).load({...period,cityId:'lyon',zoneId:'fixture'});assert.equal(s.rules.length,1);assert.equal(s.rules[0]?.effect,'FORBIDDEN');});
test('A: paid local authorization plus active DiaLog -> FORBIDDEN + PAID',async()=>{const {app}=await service('active');const r=await app.check('fixture',period,now);assert.equal(r.decision.status,'FORBIDDEN');assert.equal(r.pricing.status,'PAID');});
test('B: free local authorization plus active DiaLog -> FORBIDDEN + FREE',async()=>{const {app}=await service('active',true);const night:Period={start:'2026-09-07T20:00:00Z',end:'2026-09-07T22:00:00Z'};const r=await app.check('fixture',night,now);assert.equal(r.decision.status,'FORBIDDEN');assert.equal(r.pricing.status,'FREE');});
test('C: paid then forbidden in two hours preserves both deadlines in decision and DTO',async()=>{const s=await service('future');const r=await s.app.check('fixture',period,now);assert.equal(r.decision.status,'CONDITIONAL');assert.equal(r.pricing.status,'PAID');for(const value of [r.allowedUntil,r.mustLeaveBefore,r.decision.allowedUntil,r.decision.mustLeaveBefore])assert.equal(value,'2026-09-07T14:00:00.000Z');assert.equal(s.calls(),0);});
test('D: payment alone -> ALLOWED + PAID, no invented regulatory condition or deadline',async()=>{const s=await service('none');const r=await s.app.check('fixture',period,now);assert.equal(r.decision.status,'ALLOWED');assert.equal(r.pricing.status,'PAID');assert.deepEqual(r.conditions,[]);assert.equal(r.allowedUntil,undefined);assert.equal(r.mustLeaveBefore,undefined);assert.equal(s.calls(),0);});
test('E: active ban triggers three alternatives from authorization, regardless of pricing',async()=>{const s=await service('active');const r=await s.app.check('fixture',period,now);assert.equal(r.decision.status,'FORBIDDEN');assert.equal(s.calls(),1);assert.equal(r.nearbyParkings.length,3);assert.deepEqual(r.nearbyParkings.map(p=>p.distanceMeters),[110,220,330]);});
