import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LyonParkingFacilityAdapter,fetchOfficialJson} from '../../packages/adapters/src/lyon/facilities.js';
import {FACILITY_REALTIME_URL,ROADS_URL} from '../../packages/adapters/src/lyon/config.js';
import {realtimeMapping,normalizeRealtime} from '../../packages/adapters/src/lyon/realtime.js';
test('LIVE Lyon official static facilities structure and source date',async()=>{const f=await new LyonParkingFacilityAdapter().fetch();assert.ok(f.length>0);assert.ok(f.some(p=>p.capacity!==undefined));assert.ok(f.some(p=>p.source.updatedAt&&Number.isFinite(Date.parse(p.source.updatedAt))));console.log(JSON.stringify({event:'lyon.live.static',count:f.length,public:f.filter(x=>x.publicAccess).length}));});
test('LIVE Lyon road schema: two features only',async()=>{const d=await fetchOfficialJson(ROADS_URL+'&count=2') as {features:{properties:Record<string,unknown>;geometry:{type:string}}[]};assert.equal(d.features.length,2);for(const f of d.features){assert.equal(typeof f.properties['codefuv'],'string');assert.equal(typeof f.properties['nom'],'string');assert.equal(f.geometry.type,'MultiLineString');}});
test('LIVE Lyon realtime access, reviewed schema and freshness',async()=>{
 const data=await fetchOfficialJson(FACILITY_REALTIME_URL+'&count=2') as {features:{properties:Record<string,unknown>}[];numberMatched:number};
 console.log(JSON.stringify({event:'lyon.live.realtime.keys',keys:Object.keys(data.features[0]?.properties??{}).sort()}));
 const now=new Date().toISOString(),mapping=realtimeMapping();
 const observations=normalizeRealtime({...data,numberMatched:data.features.length},mapping,now);
 assert.ok(observations.length>0);assert.ok(observations.some(o=>o.availableSpaces!==undefined&&Date.parse(now)-Date.parse(o.updatedAt)<180000),'No fresh availability in controlled sample');
});
