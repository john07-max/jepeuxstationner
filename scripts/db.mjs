import pg from 'pg';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const databasePath='packages/database';
function connection() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database validation was performed.');
 return new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:2000,statement_timeout:60000});
}
async function ready() {
 const deadline=Date.now()+60000;
 do {
  const c=connection();
  try {await c.connect();await c.query('SELECT 1');console.log('PostgreSQL SQL connection ready');return;}
  catch {if(Date.now()>=deadline) throw new Error('PostgreSQL readiness deadline exceeded');}
  finally {await c.end();}
  await delay(1000);
 } while(Date.now()<deadline);
 throw new Error('PostgreSQL readiness deadline exceeded');
}
async function checkPostgis(c) {
 const {rows}=await c.query("SELECT extname FROM pg_extension WHERE extname='postgis'");
 if (rows.length!==1) throw new Error('PostGIS extension is absent in this database');
 const version=await c.query('SELECT PostGIS_Version() AS postgis_version, version() AS postgres_version');
 if(!version.rows[0]?.postgis_version) throw new Error('PostGIS_Version() returned no version');
 console.log(JSON.stringify({extension:rows[0].extname,...version.rows[0]},null,2));
}
async function migrate(c) {
 await c.query("SELECT pg_advisory_lock(hashtext('jps-migrations'))");
 try {
  const exists=await c.query("SELECT to_regclass('public.schema_migrations') AS present");
  const versions=exists.rows[0].present ? (await c.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>r.version) : [];
  const files=(await readdir(`${databasePath}/migrations`)).filter(f=>/^\d{3}_.+\.sql$/.test(f)).sort();
  const known=files.map(f=>Number(f.slice(0,3)));
  if (versions.some(v=>!known.includes(v)) || versions.some((v,i)=>v!==known[i])) throw new Error('Unexpected migration history');
  for (const file of files) {
   const version=Number(file.slice(0,3));
   if (versions.includes(version)) {console.log(`Already applied: ${file}`);continue;}
   try {
    await c.query(await readFile(`${databasePath}/migrations/${file}`,'utf8'));
    const saved=await c.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
    if(saved.rowCount!==1) throw new Error(`Migration did not record version ${version}`);
    console.log(`Applied: ${file}`);
   } catch (e) {await c.query('ROLLBACK');throw e;}
  }
 } finally {await c.query("SELECT pg_advisory_unlock(hashtext('jps-migrations'))");}
}
async function sqlTests(c) {
 await checkPostgis(c);
 await c.query(await readFile(`${databasePath}/tests/schema.sql`,'utf8'));
 console.log('PASS schema constraints');
 for(const name of ['geospatial','temporal']) {
  await c.query('BEGIN');
  try {
   await c.query(await readFile(`${databasePath}/fixtures/integration.sql`,'utf8'));
   await c.query(await readFile(`${databasePath}/tests/${name}.sql`,'utf8'));
   console.log(`PASS SQL/PostGIS ${name}`);
  } finally {await c.query('ROLLBACK');}
 }
}
async function explain(c) {
 await checkPostgis(c);
 await c.query('BEGIN');
 try {
  await c.query(await readFile(`${databasePath}/fixtures/spatial-plan.sql`,'utf8'));
  const query=await readFile(`${databasePath}/queries/resolve-zone.sql`,'utf8');
  const params=[-0.995,42.005,'plan-city'];
  const index=await c.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='parking_zones_area_gist'");
  if (!index.rows[0]?.indexdef.includes('USING gist')) throw new Error('Spatial GiST index missing');
  const matches=await c.query(query,params);
  if(matches.rowCount!==1) throw new Error('EXPLAIN fixture expected exactly one spatial match');
  const plan=await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,params);
  const value=plan.rows[0]['QUERY PLAN'];
  const serialized=JSON.stringify(value,null,2);
  const usesSpatialIndex=serialized.includes('parking_zones_area_gist');
  const report={fixtureRows:40000,spatialIndex:index.rows[0].indexdef,usesSpatialIndex,plan:value};
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/spatial-plan.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(!usesSpatialIndex) console.warn('Planner chose another plan. Inspect the artifact; no planner setting was forced.');
 } finally {await c.query('ROLLBACK');}
}
const command=process.argv[2];
try {
 if(command==='wait') {await ready();}
 else {
  if (!['check','migrate','reset','test','explain'].includes(command)) throw new Error('Expected wait/check/migrate/reset/test/explain');
  if(command==='reset') {
   const url=process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
   if(process.env.ALLOW_DB_RESET!=='local-disposable' || !url || !['127.0.0.1','localhost'].includes(url.hostname) || url.pathname!=='/parking') throw new Error('Reset refused: requires ALLOW_DB_RESET=local-disposable and local /parking database');
  }
  const c=connection();
  c.on('notice',notice=>console.log(notice.message));
  try {
   await c.connect();
   if(command==='check') await checkPostgis(c);
   if(command==='migrate') await migrate(c);
   if(command==='test') await sqlTests(c);
   if(command==='explain') await explain(c);
   if(command==='reset') {
    // Only project-owned tables/types, never DROP SCHEMA public or extension.
    await c.query(`BEGIN;
      DROP TABLE IF EXISTS source_coverage,parking_rules,data_sources,parking_zones,cities,schema_migrations;
      DROP TYPE IF EXISTS parking_effect,source_authority;
      COMMIT;`);
    await migrate(c);
    console.log('Disposable local project tables reset and migrations applied');
   }
  } finally {await c.end();}
 }
} catch(error) {
 // Never print connection strings or driver payloads containing credentials.
 console.error(`Database validation FAILED (${command ?? 'missing command'}): ${error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]') : 'unknown error'}`);
 process.exitCode=1;
}
