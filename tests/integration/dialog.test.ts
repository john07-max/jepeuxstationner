import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {parseDiaLog} from '../../packages/adapters/src/dialog/parser.js';
import {syncDiaLog,databaseDiaLogAdapter} from '../../packages/database/src/dialog.js';
import {ParkingDecisionEngine,decide} from '../../packages/engine/src/index.js';
import type {RuleSnapshot} from '../../packages/domain/src/index.js';
if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL required; DiaLog PostGIS NOT tested');
const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:5000,statement_timeout:30000});
const now='2026-09-05T12:00:00Z',query={cityId:'dialog-ci-city',zoneId:'dialog-ci-zone',start:now,end:'2026-09-05T16:00:00Z'};
const engine=new ParkingDecisionEngine();
const schema='dialog_test_'+process.pid;
before(async()=>{await client.connect();assert.ok((await client.query('SELECT PostGIS_Version()')).rows[0]);
 await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema},public`);
 for(const file of ['001_initial.sql','002_permanent_rules.sql','003_imported_restrictions.sql'])await client.query(await readFile('packages/database/migrations/'+file,'utf8'));
 await client.query(`INSERT INTO cities(id,name,timezone,boundary) VALUES('dialog-ci-city','Fictitious','Europe/Paris',ST_Multi(ST_GeomFromText('POLYGON((3 43,5 43,5 45,3 45,3 43))',4326)));
 INSERT INTO parking_zones(id,city_id,label,curb_side,area) VALUES('dialog-ci-zone','dialog-ci-city','Fixture','RIGHT',ST_Multi(ST_GeomFromText('POLYGON((3.9 43.9,4.1 43.9,4.1 44.1,3.9 44.1,3.9 43.9))',4326)));`);
});
after(async()=>{try{await client.query(`ROLLBACK; SET search_path TO public; DROP SCHEMA IF EXISTS ${schema} CASCADE`);}finally{await client.end();}});
async function clear(){await client.query("DELETE FROM imported_parking_rules WHERE source_id='dialog'; DELETE FROM data_sources WHERE id='dialog'");}
async function fixture(name='parking-active',retrievedAt=now){const s=await readFile(`tests/fixtures/dialog/dialog-${name}.xml`,'utf8');return parseDiaLog((async function*(){yield s;})(),retrievedAt);}
async function imported(name='parking-active',time=now){await clear();const p=await fixture(name,time);const changes=await syncDiaLog(client,p,time);console.log(JSON.stringify({event:'dialog.fixture.sync',...changes}));return p;}
async function decision(lon=4.005,lat=44,tolerance=5,time=now){const adapter=databaseDiaLogAdapter(client,lon,lat,tolerance);return decide(query,[adapter],time);}
test('DiaLog A XML -> PostgreSQL -> ST_DWithin -> ParkingRule -> FORBIDDEN',async()=>{await imported();const d=await decision();assert.equal(d.status,'FORBIDDEN');assert.equal(d.evidence[0]?.legalAuthority,'informative');console.log(JSON.stringify({scenario:'dialog-A',decision:d}));});
test('DiaLog B explicit allowed interval then ban in 2h -> CONDITIONAL allowedUntil',async()=>{await imported('parking-future');const s=await databaseDiaLogAdapter(client,4.005,44).load(query);
 const source={...s.coverageSource,id:'explicit-fixture',adapterId:'explicit-fixture',synthetic:true};delete source.legalAuthority;
 const allowed:RuleSnapshot={...query,adapterId:source.adapterId,complete:true,coverageSource:source,rules:[{...query,id:'allow',end:'2026-09-05T14:00:00Z',effect:'ALLOWED',conditions:[],source}]};
 const d=engine.evaluate(query,[allowed,s],now);assert.equal(d.status,'CONDITIONAL');assert.equal(d.allowedUntil,'2026-09-05T14:00:00.000Z');console.log(JSON.stringify({scenario:'dialog-B',decision:d}));});
test('DiaLog C expired remains auditable, cannot prohibit',async()=>{await imported('parking-expired');assert.equal((await client.query('SELECT count(*)::int AS n FROM imported_parking_rules')).rows[0].n,1);assert.equal((await decision()).status,'UNKNOWN');});
test('DiaLog D stale data -> UNKNOWN',async()=>{await imported();assert.equal((await decision(4.005,44,5,'2026-09-07T12:00:00Z')).status,'UNKNOWN');});
test('DiaLog E two overlapping restrictions both retained',async()=>{await imported('multiple');const d=await decision();assert.equal(d.status,'FORBIDDEN');assert.equal(d.segments[0]?.ruleIds.length,2);});
test('permanent unbounded range is clipped for engine',async()=>{await imported('parking-permanent');const s=await databaseDiaLogAdapter(client,4.005,44).load(query);assert.equal(s.rules[0]?.end,'2026-09-05T16:00:00.000Z');assert.equal(engine.evaluate(query,[s],now).status,'FORBIDDEN');});
test('idempotence imports twice with unique source/external_id',async()=>{const p=await imported();const c=await syncDiaLog(client,p,now);assert.deepEqual([c.inserted,c.updated,c.deactivated],[0,0,0]);assert.equal((await client.query('SELECT count(*)::int n FROM imported_parking_rules')).rows[0].n,1);});
test('update keeps identity and changes end time',async()=>{const p=await imported();p.rules[0]!.end='2026-09-05T19:00:00Z';const c=await syncDiaLog(client,p,now);assert.equal(c.updated,1);assert.equal(c.inserted,0);});
test('disappeared data logically deactivated',async()=>{await imported('multiple');const c=await syncDiaLog(client,await fixture(),now);assert.equal(c.deactivated,1);assert.equal((await client.query('SELECT count(*)::int n FROM imported_parking_rules WHERE NOT present')).rows[0].n,1);});
test('dry run computes changes with zero writes',async()=>{await imported();const before=(await client.query('SELECT * FROM imported_parking_rules ORDER BY external_id')).rows;const c=await syncDiaLog(client,await fixture('multiple'),now,true);assert.equal(c.inserted,1);assert.deepEqual((await client.query('SELECT * FROM imported_parking_rules ORDER BY external_id')).rows,before);});
test('partial errors disable disappearance processing',async()=>{await imported('multiple');const p=await fixture();p.stats.invalid=1;p.stats.fetched=200;const c=await syncDiaLog(client,p,now);assert.equal(c.deactivated,0);});
test('self intersecting geometry aborts transaction; prior import intact',async()=>{await imported();const p=await fixture();p.rules[0]!.geometry={type:'Polygon',coordinates:[[[4,44],[4.01,44.01],[4,44.01],[4.01,44],[4,44]]]};await assert.rejects(()=>syncDiaLog(client,p,now));assert.equal((await decision()).status,'FORBIDDEN');});
test('line tolerance in metres includes 2m, excludes 22m',async()=>{await imported();assert.equal((await decision(4.005,44.00002,5)).status,'FORBIDDEN');assert.equal((await decision(4.005,44.0002,5)).status,'UNKNOWN');assert.equal((await decision(4.005,44.00002,1)).status,'UNKNOWN');});
test('lon/lat inversion does not match and outside city fails closed',async()=>{await imported();assert.equal((await decision(44,4)).status,'UNKNOWN');});
test('polygon border uses ST_Covers and no line buffer',async()=>{await imported('multiple');const s=await databaseDiaLogAdapter(client,4.02,44).load(query);assert.equal(s.rules.length,1);assert.equal((await decision(4.02001,44)).status,'UNKNOWN');});
test('unsupported recurrence is not used as a continuous ban',async()=>{await imported('recurrence');assert.equal((await decision()).status,'UNKNOWN');});
test('MultiPolygon projection and EPSG:4326',async()=>{const p=await imported();p.rules[0]!.geometry={type:'MultiPolygon',coordinates:[[[[4,44],[4.01,44],[4.01,44.01],[4,44]]]]};await syncDiaLog(client,p,now);assert.equal((await client.query('SELECT ST_SRID(geometry) AS srid FROM imported_parking_rules')).rows[0].srid,4326);assert.equal((await decision(4.009,44.001)).status,'FORBIDDEN');});
test('DiaLog spatial EXPLAIN ANALYZE BUFFERS on 20000 rows without forcing index',async()=>{
 await imported();await client.query('BEGIN');try {
 await client.query(`INSERT INTO imported_parking_rules(source_id,external_id,geometry,valid_during,active,supported,retrieved_at,normalized)
 SELECT source_id,'plan-'||i,ST_Translate(geometry,(i%200)*0.02+0.1,(i/200)*0.02),valid_during,active,supported,retrieved_at,normalized
 FROM imported_parking_rules CROSS JOIN generate_series(1,20000) i WHERE source_id='dialog' AND external_id NOT LIKE 'plan-%'`);
 await client.query('ANALYZE imported_parking_rules');const sql=await readFile('packages/database/queries/dialog-at-position.sql','utf8');
 const t=performance.now();const plan=await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,[4.005,44,query.start,query.end,5]);
 console.log(JSON.stringify({event:'dialog.query.plan',durationMs:performance.now()-t,plan:plan.rows[0]}));
 assert.equal(plan.rows[0]?.['QUERY PLAN']?.[0]?.Plan?.['Actual Rows'],1);
 const indexes=await client.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='imported_parking_rules' AND indexdef LIKE '%USING gist%'");assert.equal(indexes.rowCount,3);
 }finally{await client.query('ROLLBACK');}
});
test('idempotence refreshes retrievedAt without a business update',async()=>{
 await imported();
 const later='2026-09-05T13:00:00Z';const p=await fixture('parking-active',later);
 // A column-specific trigger proves that the freshness path does not write business columns.
 await client.query(`CREATE FUNCTION reject_business_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unexpected business write'; END $$;
 CREATE TRIGGER reject_business_update BEFORE UPDATE OF geometry,valid_during,active,supported,present ON imported_parking_rules FOR EACH ROW EXECUTE FUNCTION reject_business_update()`);
 try {
  const c=await syncDiaLog(client,p,later);assert.deepEqual([c.inserted,c.updated,c.deactivated],[0,0,0]);
  const row=(await client.query('SELECT retrieved_at,normalized FROM imported_parking_rules')).rows[0];
  assert.equal(row.retrieved_at.toISOString(),'2026-09-05T13:00:00.000Z');assert.equal(row.normalized.source.retrievedAt,later);
  assert.equal((await decision(4.005,44,5,later)).status,'FORBIDDEN');
 }finally{await client.query('DROP TRIGGER reject_business_update ON imported_parking_rules; DROP FUNCTION reject_business_update()');}
});
test('idempotence ignores recursively reordered JSON properties',async()=>{
 const p=await imported();
 const reorder=(v:unknown):unknown=>Array.isArray(v)?v.map(reorder):v!==null&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
 p.rules=p.rules.map(r=>reorder(r) as typeof r);
 const c=await syncDiaLog(client,p,now);assert.deepEqual([c.inserted,c.updated,c.deactivated],[0,0,0]);
});
test('same external identity with changed geometry counts exactly one update',async()=>{
 const p=await imported();p.rules[0]!.geometry={type:'LineString',coordinates:[[4,44.001],[4.01,44.001]]};
 const c=await syncDiaLog(client,p,now);assert.deepEqual([c.inserted,c.updated,c.deactivated],[0,1,0]);
 assert.equal((await decision()).status,'UNKNOWN');assert.equal((await decision(4.005,44.001)).status,'FORBIDDEN');
});
test('identical import performs no rule row write at all',async()=>{
 await clear();const p=await fixture();const first=await syncDiaLog(client,p,now);assert.deepEqual([first.inserted,first.updated,first.deactivated],[1,0,0]);
 const before=(await client.query('SELECT xmin::text AS version FROM imported_parking_rules')).rows;
 const second=await syncDiaLog(client,p,now);assert.deepEqual([second.inserted,second.updated,second.deactivated],[0,0,0]);
 assert.deepEqual((await client.query('SELECT xmin::text AS version FROM imported_parking_rules')).rows,before);
});
