import type { DataSourceAdapter, ParkingQuery, ParkingRule, RuleSnapshot, SourceEvidence } from '../../domain/src/index.js';
export const FIXTURE_NOW = '2026-09-05T10:00:00Z';
export const fixtureQuery: ParkingQuery = { cityId:'fixture-city', zoneId:'fixture-curb-a', start:'2026-09-05T12:00:00Z', end:'2026-09-05T14:00:00Z' };
export const fixtureSource: SourceEvidence = { id:'fixture-order', adapterId:'fixture', reference:'fixture://orders/demo-001', version:'1', authority:'OFFICIAL', kind:'ORDER', synthetic:true, observedAt:'2026-09-01T00:00:00Z', freshUntil:'2026-10-01T00:00:00Z' };
export const fixtureRule: ParkingRule = { ...fixtureQuery, id:'fixture-allow', effect:'ALLOWED', conditions:[], source:fixtureSource };
export function fixtureSnapshot(): RuleSnapshot { return { ...fixtureQuery, adapterId:'fixture', complete:true, coverageSource:fixtureSource, rules:[fixtureRule] }; }
export class FictionalDataSourceAdapter implements DataSourceAdapter {
  readonly id = 'fixture';
  async load(query: ParkingQuery): Promise<RuleSnapshot> {
    const s=fixtureSnapshot();
    // Never expand fixture coverage to match an arbitrary query.
    return { ...s, complete:query.cityId === s.cityId && query.zoneId === s.zoneId };
  }
}
