import { FictionalDataSourceAdapter, fixtureQuery, FIXTURE_NOW } from '../../../packages/adapters/src/index.js';
import { decide } from '../../../packages/engine/src/index.js';
console.log(JSON.stringify(await decide(fixtureQuery,[new FictionalDataSourceAdapter()],FIXTURE_NOW),null,2));
