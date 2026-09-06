import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDiaLog} from '../packages/adapters/src/dialog/parser.js';
import {dialogBusinessFingerprint as fingerprint} from '../packages/database/src/dialog-fingerprint.js';
const parsed=await parseDiaLog((async function*(){yield await readFile('tests/fixtures/dialog/dialog-parking-active.xml','utf8');})(),'2026-09-05T12:00:00Z');
const rule=parsed.rules[0]!;
function reordered(v:unknown):unknown {
 if(Array.isArray(v))return v.map(reordered);
 if(v!==null&&typeof v==='object')return Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reordered(x)]));
 return v;
}
test('identical business rule has identical fingerprint',()=>assert.equal(fingerprint(rule),fingerprint(structuredClone(rule))));
test('recursive JSON key order does not affect business fingerprint',()=>assert.equal(fingerprint(rule),fingerprint(reordered(rule) as typeof rule)));
test('observation and freshness timestamps do not affect business fingerprint',()=>{
 const changed={...rule,source:{...rule.source,observedAt:'2026-09-05T13:00:00Z',retrievedAt:'2026-09-05T13:00:00Z',freshUntil:'2026-09-06T13:00:00Z',sourceUpdatedAt:'2026-09-05T11:00:00Z'}};
 assert.equal(fingerprint(rule),fingerprint(changed));
});
test('real end-date change changes fingerprint',()=>assert.notEqual(fingerprint(rule),fingerprint({...rule,end:'2026-09-05T19:00:00Z'})));
test('real geometry change changes fingerprint',()=>assert.notEqual(fingerprint(rule),fingerprint({...rule,geometry:{type:'Point',coordinates:[4.001,44]}})));
test('equivalent timestamps with different offsets are identical',()=>assert.equal(fingerprint(rule),fingerprint({...rule,start:'2026-09-05T12:00:00+02:00'})));
test('functional provenance and active status remain substantive',()=>{
 assert.notEqual(fingerprint(rule),fingerprint({...rule,source:{...rule.source,reference:'fixture://changed'}}));
 assert.notEqual(fingerprint(rule),fingerprint({...rule,active:!rule.active}));
});
test('JSON condition object order is normalized without sorting coordinate arrays',()=>{
 assert.equal(fingerprint({...rule,recurrence:['{"a":1,"b":2}']}),fingerprint({...rule,recurrence:['{"b":2,"a":1}']}));
 assert.notEqual(fingerprint({...rule,geometry:{type:'Point',coordinates:[4,44]}}),fingerprint({...rule,geometry:{type:'Point',coordinates:[44,4]}}));
});
