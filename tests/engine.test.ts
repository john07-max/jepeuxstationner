import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParkingDecisionEngine, decide, instant } from '../packages/engine/src/index.js';
import { fixtureQuery as q, fixtureRule as r, fixtureSnapshot, FIXTURE_NOW as now, FictionalDataSourceAdapter } from '../packages/adapters/src/index.js';
import type { ParkingRule, RuleSnapshot, DataSourceAdapter } from '../packages/domain/src/index.js';
const engine = new ParkingDecisionEngine();
const run = (rules: readonly ParkingRule[] = [r], patch: Partial<RuleSnapshot> = {}) => engine.evaluate(q,[{...fixtureSnapshot(),rules,...patch}],now);
test('explicit official permission and traceability', () => {
 const d=run(); assert.equal(d.status,'ALLOWED'); assert.equal(d.synthetic,true);
 assert.equal(d.segments[0]?.ruleIds[0],'fixture:fixture-allow'); assert.equal(d.evidence[1]?.reference,r.source.reference);
});
test('explicit prohibition',()=>assert.equal(run([{...r,effect:'FORBIDDEN'}]).status,'FORBIDDEN'));
test('conditions remain visible and are never presumed fulfilled',()=>{
 const d=run([{...r,effect:'CONDITIONAL',conditions:['Autorisation fictive requise']}]);
 assert.equal(d.status,'CONDITIONAL'); assert.deepEqual(d.segments[0]?.conditions,['Autorisation fictive requise']);
});
test('empty dataset is UNKNOWN',()=>assert.equal(run([]).status,'UNKNOWN'));
test('no adapters means UNKNOWN',()=>assert.equal(engine.evaluate(q,[],now).status,'UNKNOWN'));
test('missing coverage means UNKNOWN',()=>assert.equal(run([r],{complete:false}).status,'UNKNOWN'));
test('coverage must include the entire stay',()=>assert.equal(run([r],{end:'2026-09-05T13:00:00Z'}).status,'UNKNOWN'));
test('wrong city is UNKNOWN',()=>assert.equal(run([r],{cityId:'other'}).status,'UNKNOWN'));
test('wrong zone is UNKNOWN',()=>assert.equal(run([{...r,zoneId:'other'}]).status,'UNKNOWN'));
test('stale rule is UNKNOWN',()=>assert.equal(run([{...r,source:{...r.source,freshUntil:now}}]).status,'UNKNOWN'));
test('future observation is UNKNOWN',()=>assert.equal(run([{...r,source:{...r.source,observedAt:'2026-09-06T00:00:00Z'}}]).status,'UNKNOWN'));
test('stale coverage is UNKNOWN',()=>assert.equal(run([r],{coverageSource:{...r.source,freshUntil:now}}).status,'UNKNOWN'));
test('missing source reference is UNKNOWN',()=>assert.equal(run([{...r,source:{...r.source,reference:''}}]).status,'UNKNOWN'));
test('secondary permission cannot authorize parking',()=>assert.equal(run([{...r,source:{...r.source,authority:'SECONDARY'}}]).status,'UNKNOWN'));
test('official data prevails over secondary data',()=>assert.equal(run([r,{...r,id:'secondary',effect:'FORBIDDEN',source:{...r.source,authority:'SECONDARY'}}]).status,'ALLOWED'));
test('official signage/order disagreement is UNKNOWN',()=>{
 const d=run([r,{...r,id:'sign',effect:'FORBIDDEN',source:{...r.source,kind:'SIGNAGE'}}]);
 assert.equal(d.status,'UNKNOWN'); assert.ok(d.reasons.includes('OFFICIAL_CONFLICT'));
});
test('future prohibition is conditional with explicit departure deadline',()=>{
 const d=run([{...r,end:'2026-09-05T13:00:00Z'},{...r,id:'later',start:'2026-09-05T13:00:00Z',effect:'FORBIDDEN'}]);
 assert.equal(d.status,'CONDITIONAL'); assert.equal(d.segments.length,2);
 assert.equal(d.mustLeaveBefore,'2026-09-05T13:00:00.000Z');
 assert.equal(d.segments[1]?.status,'FORBIDDEN');
});
test('mid-stay gap cannot be allowed',()=>assert.equal(run([{...r,end:'2026-09-05T13:00:00Z'}]).status,'UNKNOWN'));
test('adjacent permissions cover stay without a gap',()=>assert.equal(run([{...r,end:'2026-09-05T13:00:00Z'},{...r,id:'next',start:'2026-09-05T13:00:00Z'}]).status,'ALLOWED'));
test('exclusive end does not apply a later prohibition',()=>assert.equal(run([r,{...r,id:'after',effect:'FORBIDDEN',start:q.end,end:'2026-09-05T15:00:00Z'}]).status,'ALLOWED'));
test('empty conditional obligations are invalid',()=>assert.equal(run([{...r,effect:'CONDITIONAL'}]).status,'UNKNOWN'));
test('permission with hidden conditions is invalid',()=>assert.equal(run([{...r,conditions:['pay']}]).status,'UNKNOWN'));
test('duplicate rule IDs are invalid',()=>assert.equal(run([r,r]).status,'UNKNOWN'));
test('duplicate adapter IDs are invalid',()=>assert.equal(engine.evaluate(q,[fixtureSnapshot(),fixtureSnapshot()],now).status,'UNKNOWN'));
for (const [name,patch] of Object.entries({reversed:{start:q.end,end:q.start},empty:{end:q.start},invalid:{start:'bad'},localTime:{start:'2026-09-05T12:00:00'},calendar:{start:'2026-02-30T12:00:00Z'}})) {
 test(`invalid query: ${name}`,()=>assert.equal(engine.evaluate({...q,...patch},[fixtureSnapshot()],now).status,'UNKNOWN'));
}
test('equivalent timezone offsets produce same decision',()=>assert.equal(engine.evaluate({...q,start:'2026-09-05T14:00:00+02:00',end:'2026-09-05T16:00:00+02:00'},[fixtureSnapshot()],now).status,'ALLOWED'));
test('deterministic engine does not mutate fixture',()=>{
 const s=fixtureSnapshot(), original=JSON.stringify(s); assert.deepEqual(engine.evaluate(q,[s],now),engine.evaluate(q,[s],now)); assert.equal(JSON.stringify(s),original);
});
test('complete fictional adapter chain',async()=>assert.equal((await decide(q,[new FictionalDataSourceAdapter()],now)).status,'ALLOWED'));
test('fictitious provider never extends to another city',async()=>assert.equal((await decide({...q,cityId:'Paris'},[new FictionalDataSourceAdapter()],now)).status,'UNKNOWN'));
test('adapter rejection never leaks exception or address',async()=>{
 const broken:DataSourceAdapter={id:'broken',async load(){throw new Error('secret address');}};
 const d=await decide(q,[new FictionalDataSourceAdapter(),broken],now); assert.equal(d.status,'UNKNOWN'); assert.ok(!JSON.stringify(d).includes('secret'));
});
test('adapter timeout fails closed even when provider ignores abort',async()=>{
 const stuck:DataSourceAdapter={id:'stuck',load:()=>new Promise(()=>{})};
 assert.equal((await decide(q,[stuck],now,10)).status,'UNKNOWN');
});
test('adapter identity mismatch fails closed',async()=>{
 const spoof:DataSourceAdapter={id:'spoof',async load(){return fixtureSnapshot();}};
 assert.equal((await decide(q,[spoof],now)).status,'UNKNOWN');
});
test('second official adapter conflict is UNKNOWN',async()=>{
 const other:DataSourceAdapter={id:'other',async load(){return {...fixtureSnapshot(),adapterId:'other',coverageSource:{...r.source,adapterId:'other'},rules:[{...r,effect:'FORBIDDEN',source:{...r.source,adapterId:'other'}}]};}};
 assert.equal((await decide(q,[new FictionalDataSourceAdapter(),other],now)).status,'UNKNOWN');
});

test('invalid calendar instant cannot be normalized by Date.parse',()=>assert.ok(Number.isNaN(instant('2026-02-30T12:00:00Z'))));
test('24:00 is rejected instead of silently rolling forward',()=>assert.ok(Number.isNaN(instant('2026-09-05T24:00:00Z'))));

test('initial prohibition remains forbidden even if permission follows',()=>{
 assert.equal(run([{...r,effect:'FORBIDDEN',end:'2026-09-05T13:00:00Z'},{...r,id:'later',start:'2026-09-05T13:00:00Z'}]).status,'FORBIDDEN');
});
test('a gap before future prohibition never creates a conditional permission',()=>{
 const d=run([{...r,start:'2026-09-05T13:00:00Z',effect:'FORBIDDEN'}]);
 assert.equal(d.status,'UNKNOWN');assert.equal(d.mustLeaveBefore,undefined);
});
test('successive changes retain earliest departure deadline',()=>{
 const d=run([{...r,end:'2026-09-05T12:30:00Z'},{...r,id:'ban',start:'2026-09-05T12:30:00Z',end:'2026-09-05T13:00:00Z',effect:'FORBIDDEN'},{...r,id:'later',start:'2026-09-05T13:00:00Z'}]);
 assert.equal(d.status,'CONDITIONAL');assert.equal(d.mustLeaveBefore,'2026-09-05T12:30:00.000Z');
});
