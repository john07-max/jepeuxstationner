import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {webServer} from '../../apps/web/server/server.js';
import {readFile,readdir} from 'node:fs/promises';
import type {GeocodingProvider} from '../../packages/domain/src/geocoding.js';
import {createLyonCheckParkingService} from '../../packages/application/src/lyon.js';
import {syncLyonFacilities,syncLyonStreets,findNearbyParkingFacilities,resolveLyonContext,storeFacilityObservation} from '../../packages/database/src/lyon.js';
import {LyonParkingFacilityAdapter} from '../../packages/adapters/src/lyon/facilities.js';
import {matchStreets} from '../../packages/adapters/src/lyon/streets.js';
import {parseDiaLog} from '../../packages/adapters/src/dialog/parser.js';
import {syncDiaLog} from '../../packages/database/src/dialog.js';
if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL required; Lyon PostgreSQL/PostGIS NOT tested');
const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:5000,statement_timeout:30000}),schema='lyon_test_'+process.pid;
const now='2026-09-07T12:00:00Z',period={start:now,end:'2026-09-07T16:00:00Z'},position={longitude:4.83,latitude:45.76};
const location={label:'FICTIONAL verified Lyon bay',provider:'fixture',coordinates:position,precision:'housenumber' as const};
const geocoder:GeocodingProvider={async search(){return [location];},async autocomplete(){return [location];},async reverse(){return location;}};
const service=createLyonCheckParkingService(client,geocoder);
const matches=matchStreets([{externalId:'fixture-road',arrondissement:2,name:'Rue Fictive',regulation:'complet',extension:'',page:1}],[{id:'T-fixture',streetId:'V-fixture',arrondissement:2,name:'Rue Fictive',geometry:{type:'MultiLineString',coordinates:[[[4.82,45.76],[4.84,45.76]]]}}],now).matches;
async function facilities(){const f=new LyonParkingFacilityAdapter().normalize(JSON.parse(await readFile('data/lyon/facilities.geojson','utf8')),now);return f.slice(0,3).map((x,i)=>({...x,id:'fixture-'+i,externalId:'fixture-'+i,name:'FICTIONAL public facility '+i,publicAccess:true,coordinates:{longitude:4.83,latitude:45.761+i*0.001}}));}
before(async()=>{await client.connect();assert.ok((await client.query('SELECT PostGIS_Version()')).rows[0]);await client.query(`CREATE SCHEMA ${schema};SET search_path TO ${schema},public`);for(const file of (await readdir('packages/database/migrations')).filter(f=>f.endsWith('.sql')).sort())await client.query(await readFile('packages/database/migrations/'+file,'utf8'));});
after(async()=>{try{await client.query(`ROLLBACK;SET search_path TO public;DROP SCHEMA IF EXISTS ${schema} CASCADE`);}finally{await client.end();}});
beforeEach(async()=>{
 await client.query('TRUNCATE imported_parking_rules,source_coverage,parking_rules,data_sources,lyon_verified_spaces,lyon_street_inventory,parking_facilities,local_source_registry,parking_zones,cities CASCADE');
 await client.query(`INSERT INTO cities(id,name,timezone,boundary) VALUES('lyon','FICTIONAL Lyon perimeter','Europe/Paris',ST_Multi(ST_GeomFromText('POLYGON((4.7 45.6,4.9 45.6,4.9 45.9,4.7 45.9,4.7 45.6))',4326)));
 INSERT INTO parking_zones(id,city_id,label,curb_side,area) VALUES('fixture-bay','lyon','FICTIONAL marked bay','RIGHT',ST_Multi(ST_GeomFromText('POLYGON((4.8299 45.7599,4.8301 45.7599,4.8301 45.7601,4.8299 45.7601,4.8299 45.7599))',4326)));`);
 await syncLyonStreets(client,matches,now);
 await client.query("INSERT INTO lyon_verified_spaces VALUES('fixture-bay','fixture-road','https://example.org/fictional-bay-survey','2026-09-06T00:00:00Z','2026-09-20T00:00:00Z','UNO')");
 await client.query(`INSERT INTO data_sources(id,adapter_id,authority,kind,reference,version,synthetic,observed_at,fresh_until) VALUES('dialog','dialog','OFFICIAL','DATASET','fixture://empty-dialog','3',true,$1,'2026-09-20T00:00:00Z')`,[now]);
});
async function restriction(start=now){
 const kind=start===now?'active':'future';
 assert.ok(start===now||start==='2026-09-07T14:00:00Z');
 const xml=await readFile(`tests/fixtures/lyon/dialog-${kind}.xml`,'utf8');
 const parsed=await parseDiaLog((async function*(){yield xml;})(),now);
 assert.equal(parsed.rules.length,1);assert.equal(parsed.rules[0]?.active,true,'Fixture must be active before persistence');
 assert.equal(parsed.rules[0]?.start,new Date(start).toISOString());
 const changes=await syncDiaLog(client,parsed,now);assert.equal(changes.inserted,1);
 const selected=await client.query(await readFile('packages/database/queries/dialog-at-position.sql','utf8'),[position.longitude,position.latitude,period.start,period.end,5]);
 assert.equal(selected.rowCount,1,'Actual spatial query must select the fixture restriction');
}
test('Lyon DB A: verified Monday space -> ALLOWED and PAID',async()=>{const r=await service.check('fixture',period,now);assert.equal(r.decision.status,'ALLOWED');assert.equal(r.pricing.status,'PAID');assert.equal(r.pricing.amount,undefined);});
test('Lyon DB B: verified Sunday space -> ALLOWED and FREE',async()=>{const r=await service.check('fixture',{start:'2026-09-06T12:00:00Z',end:'2026-09-06T14:00:00Z'},now);assert.equal(r.decision.status,'ALLOWED');assert.equal(r.pricing.status,'FREE');});
test('Lyon DB C: real spatial DiaLog restriction overrides local general rule',async()=>{await restriction();const r=await service.check('fixture',period,now);assert.equal(r.decision.status,'FORBIDDEN');});
test('Lyon DB D: future ban in two hours -> CONDITIONAL with deadline',async()=>{await restriction('2026-09-07T14:00:00Z');const r=await service.check('fixture',period,now);assert.equal(r.decision.status,'CONDITIONAL');assert.equal(r.allowedUntil,'2026-09-07T14:00:00.000Z');assert.equal(r.mustLeaveBefore,r.allowedUntil);assert.equal(r.decision.allowedUntil,r.allowedUntil);assert.equal(r.decision.mustLeaveBefore,r.mustLeaveBefore);});
test('Lyon DB E: no verified local coverage plus empty DiaLog -> UNKNOWN',async()=>{await client.query('DELETE FROM lyon_verified_spaces');assert.equal((await service.check('fixture',period,now)).decision.status,'UNKNOWN');});
test('Lyon DB F: forbidden -> three nearby public facilities ordered by metres',async()=>{await restriction();await syncLyonFacilities(client,await facilities(),now);const r=await service.check('fixture',period,now);assert.equal(r.decision.status,'FORBIDDEN');assert.equal(r.nearbyParkings.length,3);assert.ok(r.nearbyParkings[0]!.distanceMeters>100&&r.nearbyParkings[0]!.distanceMeters<120);assert.ok(r.nearbyParkings[0]!.distanceMeters<r.nearbyParkings[1]!.distanceMeters);assert.ok(r.nearbyParkings[1]!.distanceMeters<r.nearbyParkings[2]!.distanceMeters);});
test('Lyon DB exact polygon border ST_Covers and overlapping zones ambiguous',async()=>{assert.ok(await resolveLyonContext(client,{longitude:4.8299,latitude:45.76},period,now));await client.query("INSERT INTO parking_zones SELECT 'overlap',city_id,label,curb_side,area FROM parking_zones WHERE id='fixture-bay'");assert.equal(await resolveLyonContext(client,position,period,now),undefined);});
test('Lyon DB lon/lat inversion and unknown curb rejected',async()=>{assert.equal(await resolveLyonContext(client,{longitude:45.76,latitude:4.83},period,now),undefined);await client.query("UPDATE parking_zones SET curb_side='UNKNOWN'");assert.equal(await resolveLyonContext(client,position,period,now),undefined);});
test('Lyon DB stale street evidence -> UNKNOWN',async()=>{await client.query("UPDATE lyon_street_inventory SET retrieved_at='2026-08-01T00:00:00Z'");assert.equal((await service.check('fixture',period,now)).decision.status,'UNKNOWN');});
test('Lyon DB facility idempotence and technical retrieval refresh',async()=>{const f=await facilities();const first=await syncLyonFacilities(client,f,now);assert.equal(first.inserted,3);const second=await syncLyonFacilities(client,f.map(x=>({...x,source:{...x.source,retrievedAt:'2026-09-07T12:01:00Z'}})),'2026-09-07T12:01:00Z');assert.deepEqual([second.inserted,second.updated,second.unchanged,second.deactivated],[0,0,3,0]);});
test('Lyon DB real facility capacity change and logical deactivation',async()=>{const f=await facilities();await syncLyonFacilities(client,f,now);const c=await syncLyonFacilities(client,[{...f[0]!,capacity:999}],now);assert.equal(c.updated,1);assert.equal(c.deactivated,2);});
test('Lyon DB dry-run has zero writes',async()=>{const f=await facilities();const c=await syncLyonFacilities(client,f,now,true);assert.equal(c.inserted,3);assert.equal((await client.query('SELECT count(*)::int n FROM parking_facilities')).rows[0].n,0);});
test('Lyon DB invalid coordinates roll back complete import',async()=>{const f=await facilities();f[1]!.coordinates={longitude:181,latitude:45};await assert.rejects(()=>syncLyonFacilities(client,f,now));assert.equal((await client.query('SELECT count(*)::int n FROM parking_facilities')).rows[0].n,0);});
test('Lyon DB street idempotence, update and dry-run',async()=>{assert.equal((await syncLyonStreets(client,matches,now)).unchanged,1);const changed=matches.map(m=>({...m,eligible:false}));assert.equal((await syncLyonStreets(client,changed,now,true)).updated,1);assert.equal((await syncLyonStreets(client,matches,now)).updated,0);assert.equal((await syncLyonStreets(client,changed,now)).updated,1);assert.equal((await service.check('fixture',period,now)).decision.status,'UNKNOWN');});
test('Lyon DB availability stored, stale hidden, older observation ignored',async()=>{await syncLyonFacilities(client,await facilities(),now);await storeFacilityObservation(client,{externalId:'fixture-0',updatedAt:now,availableSpaces:12});await storeFacilityObservation(client,{externalId:'fixture-0',updatedAt:'2026-09-07T11:59:00Z',availableSpaces:99});assert.equal((await findNearbyParkingFacilities(client,position,1500,3,now))[0]?.availableSpaces,12);const stale=await findNearbyParkingFacilities(client,position,1500,3,'2026-09-07T12:03:00Z');assert.equal(stale.length,3);assert.equal(stale[0]?.availableSpaces,undefined);assert.equal(stale[0]?.realtime,'UNKNOWN');});
test('Lyon DB radius and limit, subscribers excluded',async()=>{const f=await facilities();await syncLyonFacilities(client,f,now);assert.equal((await findNearbyParkingFacilities(client,position,150,3,now)).length,1);assert.equal((await findNearbyParkingFacilities(client,position,1500,1,now)).length,1);await syncLyonFacilities(client,f.map(x=>({...x,publicAccess:false})),now);assert.equal((await findNearbyParkingFacilities(client,position,1500,3,now)).length,0);});
test('Lyon DB end-to-end offline target <500ms and unforced EXPLAIN ANALYZE',async()=>{
 await restriction();await syncLyonFacilities(client,await facilities(),now);
 await client.query(`INSERT INTO parking_facilities(source_id,external_id,position,normalized,retrieved_at)
 SELECT source_id,'plan-'||i,ST_SetSRID(ST_MakePoint(5+(i%200)*0.001,46+(i/200)*0.001),4326),normalized,retrieved_at
 FROM parking_facilities CROSS JOIN generate_series(1,20000) i WHERE external_id='fixture-0'`);
 await client.query('ANALYZE parking_facilities');
 const began=performance.now();const r=await service.check('fixture',period,now);const durationMs=performance.now()-began;
 console.log(JSON.stringify({event:'lyon.offline.performance',durationMs,targetMs:500,setupExcluded:true}));
 assert.equal(r.decision.status,'FORBIDDEN');assert.equal(r.nearbyParkings.length,3);
 const sql=await readFile('packages/database/queries/nearby-facilities.sql','utf8');const plan=await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,[position.longitude,position.latitude,1500,3]);
 console.log(JSON.stringify({event:'lyon.nearby.plan',plan:plan.rows[0]}));assert.equal(plan.rows[0]?.['QUERY PLAN']?.[0]?.Plan?.['Actual Rows'],3);
 assert.ok(durationMs<500,`Offline pipeline ${durationMs} ms exceeds target`);
 assert.equal((await client.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname='parking_facilities_geography_gist'")).rowCount,1);
});

// Fixtures and migrations run before the timer. HTTP -> service -> real PostGIS -> engine.
test('Lyon DB HTTP API preserves prohibition and three facilities in under 500ms',async()=>{
 await restriction();await syncLyonFacilities(client,await facilities(),now);
 const server=webServer({geocoder,now:()=>Date.parse(now),ready:async()=>true,
  async inCity(p){return (await client.query("SELECT ST_Covers(boundary,ST_SetSRID(ST_MakePoint($1,$2),4326)) covered FROM cities WHERE id='lyon'",[p.longitude,p.latitude])).rows[0]?.covered===true;},
  check:async(input,observed)=>service.checkPosition(input,{start:input.start,end:input.end},observed,input.vehicle)},'http://localhost');
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const address=server.address();assert.ok(address&&typeof address==='object');
  const began=performance.now();
  const response=await fetch(`http://127.0.0.1:${address.port}/api/parking/check`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...position,...period})});
  const result=await response.json();const durationMs=performance.now()-began;
  console.log(JSON.stringify({event:'api.offline.performance',durationMs,targetMs:500,setupExcluded:true}));
  assert.equal(response.status,200);assert.equal(result.decision.status,'FORBIDDEN');assert.equal(result.pricing.status,'PAID');assert.equal(result.nearbyParkings.length,3);
  assert.ok(durationMs<500,`Real HTTP/DB request took ${durationMs}ms`);
 } finally {await new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});}
});
