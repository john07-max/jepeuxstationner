import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
// These validate failure guards only: they never connect to PostgreSQL.
for (const command of ['wait','check','migrate','test','explain']) {
 test(`DB command ${command} fails when DATABASE_URL is absent`,()=>{
  const result=spawnSync(process.execPath,['scripts/db.mjs',command],{encoding:'utf8',env:{...process.env,DATABASE_URL:''}});
  assert.equal(result.status,1);assert.match(result.stderr,/DATABASE_URL is required/);
 });
}
test('db:reset requires explicit disposable database opt-in',()=>{
 const result=spawnSync(process.execPath,['scripts/db.mjs','reset'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://parking:unused@127.0.0.1:5432/parking',ALLOW_DB_RESET:''}});
 assert.equal(result.status,1);assert.match(result.stderr,/Reset refused/);
});
test('db:reset refuses a remote database even with opt-in',()=>{
 const result=spawnSync(process.execPath,['scripts/db.mjs','reset'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://parking:unused@example.invalid:5432/parking',ALLOW_DB_RESET:'local-disposable'}});
 assert.equal(result.status,1);assert.match(result.stderr,/Reset refused/);
});
test('integration command cannot pass or skip without a database URL',()=>{
 const env:NodeJS.ProcessEnv={...process.env,DATABASE_URL:''};
 // A nested Node test runner must not inherit the parent runner IPC context.
 delete env['NODE_TEST_CONTEXT'];
 const result=spawnSync(process.execPath,['--test','dist/tests/integration/database-engine.test.js'],{encoding:'utf8',env});
 assert.equal(result.status,1);assert.match(result.stdout+result.stderr,/PostgreSQL integration has NOT been tested/);
});
