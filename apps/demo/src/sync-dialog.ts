import pg from 'pg';
import { DiaLogHttpClient } from '../../../packages/adapters/src/dialog/http.js';
import { syncDiaLog } from '../../../packages/database/src/dialog.js';
const metric=(event:string,value:number)=>console.log(JSON.stringify({event,value}));
const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:5000,statement_timeout:30000});
const began=performance.now();
try {
 if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL_REQUIRED');
 if(process.argv.slice(2).some(a=>a!=='--dry-run'))throw new Error('UNKNOWN_ARGUMENT');
 const now=new Date().toISOString();
 const parsed=await new DiaLogHttpClient({metric,timeoutMs:Number(process.env['DIALOG_TIMEOUT_MS']??60000),freshnessMs:Number(process.env['DIALOG_FRESHNESS_MS']??86400000),maxBytes:Number(process.env['DIALOG_MAX_BYTES']??134217728)}).download(now);
 await client.connect();const changes=await syncDiaLog(client,parsed,now,process.argv.includes('--dry-run'));
 for(const k of ['inserted','updated','deactivated'] as const)metric('dialog.sync.'+k,changes[k]);metric('dialog.sync.duration',changes.durationMs);
 console.log(JSON.stringify({Fetched:parsed.stats.fetched,Parsed:parsed.stats.parsed,Accepted:parsed.stats.accepted,Ignored:parsed.stats.ignored,Inserted:changes.inserted,Updated:changes.updated,Deactivated:changes.deactivated,Invalid:parsed.stats.invalid+changes.invalid,Duration:performance.now()-began,DryRun:changes.dryRun}));
}catch(e){console.error(JSON.stringify({event:'dialog.sync.failure',code:e instanceof Error&&e.name==='DiaLogError'?e.message:'SYNC_FAILED'}));process.exitCode=1;}finally{await client.end();}
