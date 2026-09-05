import type { DataSourceAdapter, ParkingDecision, ParkingQuery, RuleSnapshot, SourceEvidence, DecisionSegment } from '../../domain/src/index.js';
export const ENGINE_VERSION = '0.0.2';
const notice = 'Résultat indicatif. La signalisation sur place et les arrêtés officiels prévalent.';
// Require an explicit offset; never interpret the host machine timezone.
export function instant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const day = value.slice(0,10);
  const calendar = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== day || Number(value.slice(11,13)) > 23) return NaN;
  return Date.parse(value);
}
function interval(start: string, end: string): boolean { return Number.isFinite(instant(start)) && instant(start) < instant(end); }
function validSource(s: SourceEvidence, adapterId: string, now: number): boolean {
  return Boolean(s.id && s.reference && s.version && s.adapterId === adapterId &&
    ['OFFICIAL', 'SECONDARY'].includes(s.authority) && ['SIGNAGE','ORDER','DATASET'].includes(s.kind) &&
    typeof s.synthetic === 'boolean' && instant(s.observedAt) <= now && now < instant(s.freshUntil));
}
export class ParkingDecisionEngine {
  evaluate(query: ParkingQuery, snapshots: readonly RuleSnapshot[], evaluatedAt: string): ParkingDecision {
    const now = instant(evaluatedAt);
    const result = (status: ParkingDecision['status'], reasons: string[], segments: DecisionSegment[] = [], evidence: SourceEvidence[] = []): ParkingDecision => ({
      status, reasons, segments, evidence, evaluatedAt, engineVersion: ENGINE_VERSION,
      synthetic: evidence.some(s => s.synthetic), notice,
    });
    if (!query.cityId || !query.zoneId || !interval(query.start, query.end) || !Number.isFinite(now)) return result('UNKNOWN', ['INVALID_QUERY']);
    if (!snapshots.length) return result('UNKNOWN', ['NO_DATA']);
    const evidence = snapshots.flatMap(s => [s.coverageSource, ...s.rules.map(r => r.source)]);
    const ids = new Set<string>();
    for (const s of snapshots) {
      if (ids.has(s.adapterId)) return result('UNKNOWN', ['DUPLICATE_ADAPTER'], [], evidence);
      ids.add(s.adapterId);
      const ruleIds = new Set<string>();
      if (!s.adapterId || s.cityId !== query.cityId || s.zoneId !== query.zoneId || !s.complete ||
          !interval(s.start,s.end) || instant(s.start) > instant(query.start) || instant(s.end) < instant(query.end) ||
          !validSource(s.coverageSource,s.adapterId,now) || s.coverageSource.authority !== 'OFFICIAL') return result('UNKNOWN', ['INCOMPLETE_OR_STALE_COVERAGE'], [], evidence);
      for (const r of s.rules) {
        if (!r.id || ruleIds.has(r.id) || r.cityId !== query.cityId || r.zoneId !== query.zoneId || !interval(r.start,r.end) ||
            !validSource(r.source,s.adapterId,now) || !['ALLOWED','FORBIDDEN','CONDITIONAL'].includes(r.effect) ||
            (r.effect === 'CONDITIONAL' ? !r.conditions.length || r.conditions.some(c => !c.trim()) : r.conditions.length !== 0)) return result('UNKNOWN', ['INVALID_OR_STALE_RULE'], [], evidence);
        ruleIds.add(r.id);
      }
    }
    const rules = snapshots.flatMap(s => s.rules);
    const start = instant(query.start), end = instant(query.end);
    const boundaries = [...new Set([start,end,...rules.flatMap(r => [instant(r.start),instant(r.end)]).filter(t => t > start && t < end)])].sort((a,b) => a-b);
    const segments: DecisionSegment[] = [];
    for (let i=0; i<boundaries.length-1; i++) {
      const a=boundaries[i]!, b=boundaries[i+1]!;
      const active = rules.filter(r => instant(r.start) <= a && instant(r.end) >= b);
      const official = active.filter(r => r.source.authority === 'OFFICIAL');
      const effects = new Set(official.map(r => r.effect));
      // No invented hierarchy between official signage and an official order.
      const status = effects.size === 1 ? official[0]!.effect : 'UNKNOWN';
      segments.push({ start:new Date(a).toISOString(), end:new Date(b).toISOString(), status,
        reason:effects.size > 1 ? 'OFFICIAL_CONFLICT' : effects.size === 0 ? 'NO_OFFICIAL_RULE' : 'EXPLICIT_OFFICIAL_RULE',
        ruleIds:official.map(r => `${r.source.adapterId}:${r.id}`).sort(),
        conditions:[...new Set(official.flatMap(r => r.conditions))].sort() });
    }
    const firstForbidden=segments.find(s=>s.status==='FORBIDDEN');
    const hasUnknown=segments.some(s=>s.status==='UNKNOWN');
    const status = segments[0]?.status==='FORBIDDEN' ? 'FORBIDDEN' :
      hasUnknown ? 'UNKNOWN' : firstForbidden ? 'CONDITIONAL' :
      segments.some(s=>s.status==='CONDITIONAL') ? 'CONDITIONAL' : 'ALLOWED';
    const reasons=[...new Set(segments.map(s=>s.reason))];
    if(status==='CONDITIONAL' && firstForbidden) {
      reasons.push('FUTURE_PROHIBITION_MUST_LEAVE');
      return {...result(status,reasons,segments,evidence),mustLeaveBefore:firstForbidden.start};
    }
    return result(status,reasons,segments,evidence);
  }
}
export async function decide(query: ParkingQuery, adapters: readonly DataSourceAdapter[], evaluatedAt: string, timeoutMs = 2000): Promise<ParkingDecision> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshots = await Promise.race([
      Promise.all(adapters.map(async a => { const s = await a.load(query, controller.signal); if (s.adapterId !== a.id) throw new Error('Adapter identity'); return s; })),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, timeoutMs); }),
    ]);
    return new ParkingDecisionEngine().evaluate(query,snapshots,evaluatedAt);
  } catch {
    return { status:'UNKNOWN', evaluatedAt, engineVersion:ENGINE_VERSION, synthetic:false,
      reasons:['ADAPTER_FAILURE'], segments:[], evidence:[], notice };
  } finally { if (timer) clearTimeout(timer); controller.abort(); }
}
