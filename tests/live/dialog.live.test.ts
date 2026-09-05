import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DiaLogHttpClient} from '../../packages/adapters/src/dialog/http.js';
test('official DiaLog HTTP + complete streaming DATEX 3 compatibility (one request)',{timeout:125000},async()=>{
 const r=await new DiaLogHttpClient({retries:0,timeoutMs:120000}).download(new Date().toISOString());
 assert.ok(r.stats.fetched>0,'Recognized trafficRegulationOrder required');assert.ok(r.stats.accepted>0,'Recognized parking restriction required');
 console.log(JSON.stringify({stats:r.stats,memory:process.memoryUsage(),supported:r.rules.filter(x=>x.supported).length}));
});
