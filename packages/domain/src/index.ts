export type ParkingStatus = 'ALLOWED' | 'FORBIDDEN' | 'CONDITIONAL' | 'UNKNOWN';
export interface Period { readonly start: string; readonly end: string }
export interface ParkingQuery extends Period {
  readonly cityId: string;
  /** Exact normalized curb/zone identifier. No fuzzy address inference here. */
  readonly zoneId: string;
}
export interface SourceEvidence {
  readonly id: string;
  readonly adapterId: string;
  readonly reference: string;
  readonly version: string;
  readonly authority: 'OFFICIAL' | 'SECONDARY';
  readonly kind: 'SIGNAGE' | 'ORDER' | 'DATASET';
  readonly synthetic: boolean;
  readonly observedAt: string;
  readonly freshUntil: string;
}
export interface ParkingRule extends Period {
  readonly id: string;
  readonly cityId: string;
  readonly zoneId: string;
  readonly effect: Exclude<ParkingStatus, 'UNKNOWN'>;
  readonly conditions: readonly string[];
  readonly source: SourceEvidence;
}
export interface RuleSnapshot extends Period {
  readonly adapterId: string;
  readonly cityId: string;
  readonly zoneId: string;
  /** An adapter must explicitly attest completeness for this exact scope. */
  readonly complete: boolean;
  readonly coverageSource: SourceEvidence;
  readonly rules: readonly ParkingRule[];
}
export interface DataSourceAdapter {
  readonly id: string;
  load(query: ParkingQuery, signal?: AbortSignal): Promise<RuleSnapshot>;
}
export interface DecisionSegment extends Period {
  readonly status: ParkingStatus;
  readonly reason: string;
  readonly ruleIds: readonly string[];
  readonly conditions: readonly string[];
}
export interface ParkingDecision {
  readonly status: ParkingStatus;
  readonly evaluatedAt: string;
  readonly engineVersion: string;
  readonly synthetic: boolean;
  readonly reasons: readonly string[];
  readonly segments: readonly DecisionSegment[];
  readonly evidence: readonly SourceEvidence[];
  /** First future prohibition, only when the stay is initially permitted. */
  readonly mustLeaveBefore?: string;
  readonly notice: string;
}
