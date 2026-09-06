import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodEnd,parisInstant,localParis} from '../apps/web/src/time.js';
const now=Date.parse('2026-09-07T12:00:00Z');
for(const hours of ['1','2','4'])test(`Duration ${hours} hours means exact elapsed time`,()=>assert.equal(periodEnd(hours,now)-now,Number(hours)*3600000));
test('This night ends at next Paris 08:00',()=>assert.equal(new Date(periodEnd('night',now)).toISOString(),'2026-09-08T06:00:00.000Z'));
test('Before 08h this night ends this morning',()=>assert.equal(new Date(periodEnd('night',Date.parse('2026-09-07T03:00:00Z'))).toISOString(),'2026-09-07T06:00:00.000Z'));
test('Morning option ends next 10:00 Paris',()=>assert.equal(new Date(periodEnd('morning',now)).toISOString(),'2026-09-08T08:00:00.000Z'));
test('Paris custom nonexistent and repeated DST hours rejected',()=>{assert.throws(()=>parisInstant('2026-03-29T02:30'));assert.throws(()=>parisInstant('2026-10-25T02:30'));});
test('Custom time and display use Paris independently of host timezone',()=>{assert.equal(new Date(parisInstant('2026-09-07T16:30')).toISOString(),'2026-09-07T14:30:00.000Z');assert.equal(localParis(now),'2026-09-07T14:00');});

test('Tomorrow morning is the next calendar day even before 10h',()=>assert.equal(new Date(periodEnd('morning',Date.parse('2026-09-07T03:00:00Z'))).toISOString(),'2026-09-08T08:00:00.000Z'));
