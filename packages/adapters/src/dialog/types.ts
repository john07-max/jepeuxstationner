export class DiaLogError extends Error {
 constructor(readonly code:'HTTP'|'RATE_LIMITED'|'TIMEOUT'|'NETWORK'|'XML'|'SCHEMA'|'LIMIT'|'INVALID'|'QUALITY'|'CONFIG', readonly retryAfterMs=0) { super(`DiaLog: ${code}`); this.name='DiaLogError'; }
}
export type Metric = (event:string, value:number)=>void;
export const silentMetric:Metric=()=>{};
export const DIALOG_ENDPOINT='https://dialog.beta.gouv.fr/api/regulations.xml';
export const DIALOG_NOTICE="Information issue de DiaLog. La signalisation sur place et l'arrêté officiel prévalent.";
export interface ParseStats { fetched:number; parsed:number; accepted:number; ignored:number; invalid:number; bytes:number; durationMs:number; }
