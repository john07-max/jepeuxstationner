import pg from 'pg';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { LyonParkingFacilityAdapter,fetchOfficialJson } from '../../../packages/adapters/src/lyon/facilities.js';
import { ROADS_URL } from '../../../packages/adapters/src/lyon/config.js';
import { matchStreets,parseRoads } from '../../../packages/adapters/src/lyon/streets.js';
import type { OfficialStreet } from '../../../packages/adapters/src/lyon/streets.js';
import { syncLyonFacilities,syncLyonStreets,storeFacilityObservation } from '../../../packages/database/src/lyon.js';
import { fetchLyonRealtime,realtimeMapping } from '../../../packages/adapters/src/lyon/realtime.js';
const kind=process.argv[2],dryRun=process.argv.includes('--dry-run');
try {
 if(!['parking-rules','facilities','coverage'].includes(kind??''))throw new Error('Expected parking-rules, facilities or coverage');
 const now=new Date().toISOString();
 // Explicit offline input supports reproducible imports of archived official data.
 const option=process.argv.indexOf('--file');const file=option>=0?process.argv[option+1]:undefined;
 if(option>=0&&!file)throw new Error('--file requires a path');
 if(kind==='facilities') {
  const adapter=new LyonParkingFacilityAdapter();
  const archived=file?JSON.parse(await readFile(file,'utf8')) as {timeStamp?:string}:undefined;
  if(archived&&!archived.timeStamp)throw new Error('Archived snapshot requires original timeStamp');
  const retrievedAt=archived?.timeStamp??now;
  const facilities=archived?adapter.normalize(archived,retrievedAt):await adapter.fetch();
  const observations=process.argv.includes('--realtime')?await fetchLyonRealtime(realtimeMapping(),now):undefined;
  if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL required; facilities were not persisted');
  const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:5000,statement_timeout:30000});
  try{await client.connect();console.log(JSON.stringify(await syncLyonFacilities(client,facilities,retrievedAt,dryRun)));if(observations&&!dryRun){await client.query('BEGIN');try{for(const o of observations)await storeFacilityObservation(client,o);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}}}finally{await client.end();}
 }else{
  const data=file?JSON.parse(await readFile(file,'utf8')) as unknown:await fetchOfficialJson(ROADS_URL+'&count=10000&CQL_FILTER='+encodeURIComponent("nomcommune LIKE 'Lyon%'"));
  const annex=JSON.parse(await readFile('data/lyon/streets.json','utf8')) as {streets:OfficialStreet[]};
  const {matches,report}=matchStreets(annex.streets,parseRoads(data),now);
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/lyon-coverage.json',JSON.stringify({generatedAt:now,report,matches},null,2)+'\n');console.log(JSON.stringify(report));
  if(kind!=='coverage'){
   if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL required; no street rules were persisted');
   const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:5000,statement_timeout:30000});
   try{await client.connect();console.log(JSON.stringify(await syncLyonStreets(client,matches,file?(data as {timeStamp:string}).timeStamp:now,dryRun)));}finally{await client.end();}
  }
 }
}catch(e){console.error(e instanceof Error?e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'):'Lyon sync failed');process.exitCode=1;}
