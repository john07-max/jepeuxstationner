import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { resolveZone, readSnapshots } from '../../packages/database/src/read-snapshots.js';
import { ParkingDecisionEngine } from '../../packages/engine/src/index.js';
import type { ParkingQuery } from '../../packages/domain/src/index.js';
// No skip, mock, in-memory substitute or fallback. Absent database is a failure.
if (!process.env['DATABASE_URL']) throw new Error('DATABASE_URL required: PostgreSQL integration has NOT been tested');
const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:3000,statement_timeout:30000});
const start='2026-09-05T12:00:00Z', end='2026-09-05T14:00:00Z';
const engine=new ParkingDecisionEngine();
before(async()=>{
 await client.connect();
 const ext=await client.query("SELECT extname FROM pg_extension WHERE extname='postgis'");
 assert.equal(ext.rowCount,1,'PostGIS must be installed');
 const version=await client.query('SELECT PostGIS_Version() AS version');
 assert.ok(version.rows[0]?.version);
 console.log(`Integration database PostGIS: ${String(version.rows[0]?.version)}`);
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 await client.query(await readFile('packages/database/fixtures/integration.sql','utf8'));
});
after(async()=>{try {await client.query('ROLLBACK');} finally {await client.end();}});
async function scenario(index:number) {
 const location=await resolveZone(client,Number((4+index*.02+.005).toFixed(3)),44.005,'ci-city');
 assert.equal(location.reason,'RESOLVED');assert.ok(location.zoneId);
 const query:ParkingQuery={cityId:'ci-city',zoneId:location.zoneId,start,end};
 const snapshots=await readSnapshots(client,query);
 return {decision:engine.evaluate(query,snapshots,start),snapshots};
}
test('A: real spatial lookup and active restriction -> FORBIDDEN',async()=>{
 const {decision:d,snapshots}=await scenario(0);
 assert.equal(d.status,'FORBIDDEN');assert.equal(snapshots[0]?.rules[0]?.effect,'FORBIDDEN');
 assert.equal(d.synthetic,true);assert.equal(d.evidence[0]?.reference,'fixture://ci/order');
 assert.ok(d.segments[0]?.ruleIds.includes('ci-adapter:ci-rule-0'));
 console.log(JSON.stringify({scenario:'A',decision:d}));
});
test('B: permitted at start, future restriction -> CONDITIONAL and must leave',async()=>{
 const {decision:d}=await scenario(1);
 assert.equal(d.status,'CONDITIONAL');assert.equal(d.mustLeaveBefore,'2026-09-05T13:00:00.000Z');
 assert.deepEqual(d.segments.map(s=>s.status),['ALLOWED','FORBIDDEN']);
 assert.ok(d.reasons.includes('FUTURE_PROHIBITION_MUST_LEAVE'));
 console.log(JSON.stringify({scenario:'B',decision:d}));
});
test('C: no reliable coverage -> UNKNOWN',async()=>{
 const {decision:d,snapshots}=await scenario(2);assert.equal(snapshots.length,0);assert.equal(d.status,'UNKNOWN');
 console.log(JSON.stringify({scenario:'C',decision:d}));
});
test('explicit allowed source -> ALLOWED',async()=>assert.equal((await scenario(3)).decision.status,'ALLOWED'));
test('explicit conditions survive database mapping',async()=>{
 const d=(await scenario(4)).decision;assert.equal(d.status,'CONDITIONAL');assert.deepEqual(d.segments[0]?.conditions,['Permis fictif requis']);
});
test('contradictory official sources -> UNKNOWN',async()=>{
 const d=(await scenario(5)).decision;assert.equal(d.status,'UNKNOWN');assert.ok(d.reasons.includes('OFFICIAL_CONFLICT'));
});
test('official authority prevails over secondary source',async()=>assert.equal((await scenario(6)).decision.status,'ALLOWED'));
test('stale rule is not filtered out to fabricate permission',async()=>{
 const {decision:d,snapshots}=await scenario(7);assert.equal(snapshots[0]?.rules.length,1);assert.equal(d.status,'UNKNOWN');assert.ok(d.reasons.includes('INVALID_OR_STALE_RULE'));
});
for (const [name,index] of [['expired',8],['future outside stay',9]] as const) {
 test(`${name}: real temporal query returns no active rule -> UNKNOWN`,async()=>{
  const {decision:d,snapshots}=await scenario(index);assert.equal(snapshots[0]?.rules.length,0);assert.equal(d.status,'UNKNOWN');
 });
}
test('permanent rule is clipped to evaluation period',async()=>{
 const {decision:d,snapshots}=await scenario(10);assert.equal(d.status,'ALLOWED');
 assert.equal(snapshots[0]?.rules[0]?.start,'2026-09-05T12:00:00.000Z');assert.equal(snapshots[0]?.rules[0]?.end,'2026-09-05T14:00:00.000Z');
});
test('successive changes retain earliest prohibition',async()=>{
 const d=(await scenario(11)).decision;assert.equal(d.status,'CONDITIONAL');assert.equal(d.segments.length,3);assert.equal(d.mustLeaveBefore,'2026-09-05T12:30:00.000Z');
});
test('stale coverage -> UNKNOWN',async()=>assert.equal((await scenario(12)).decision.status,'UNKNOWN'));
test('unknown curb cannot be silently selected',async()=>assert.equal((await resolveZone(client,4.265,44.005,'ci-city')).reason,'UNKNOWN_CURB'));
test('overlapping zones do not choose the first one',async()=>{
 const location=await resolveZone(client,5.015,44.015,'ci-city');assert.equal(location.reason,'AMBIGUOUS_ZONE');assert.equal(location.zoneId,null);
 const d=engine.evaluate({cityId:'ci-city',zoneId:'',start,end},[],start);assert.equal(d.status,'UNKNOWN');
});
test('longitude/latitude inversion gives no match',async()=>assert.equal((await resolveZone(client,44.005,4.005,'ci-city')).reason,'NO_ZONE'));
test('boundary resolves with ST_Covers in the actual query',async()=>assert.equal((await resolveZone(client,4,44.005,'ci-city')).zoneId,'ci-active'));
test('both parts of a MultiPolygon resolve to one zone',async()=>{
 for(const longitude of [4.505,4.525]) assert.equal((await resolveZone(client,longitude,44.005,'ci-city')).zoneId,'ci-multi');
});
test('out-of-range coordinates are rejected',async()=>assert.equal((await resolveZone(client,4,95,'ci-city')).reason,'INVALID_COORDINATES'));
