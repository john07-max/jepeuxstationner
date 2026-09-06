import type { DataSourceAdapter, ParkingQuery, RuleSnapshot } from '../../../domain/src/index.js';
import type { ParkingCoverage } from '../../../domain/src/local-parking.js';
import { paymentSegments } from './calendar.js';
import { LYON_REVIEW_UNTIL, LYON_TARIFF } from './config.js';
export class LyonParkingDataSourceAdapter implements DataSourceAdapter {
 readonly id='lyon-parking';
 constructor(private readonly coverage:ParkingCoverage){}
 async load(query:ParkingQuery,signal?:AbortSignal):Promise<RuleSnapshot> {
  signal?.throwIfAborted();const c=this.coverage;
  const complete=c.status==='DOCUMENTED'&&c.markedSpaceVerified&&!c.ambiguous&&c.regime==='UNO'&&c.cityId===query.cityId&&c.zoneId===query.zoneId&&
   Date.parse(query.start)>=Date.parse(LYON_TARIFF.effectiveFrom)&&Date.parse(query.end)<=Date.parse(LYON_REVIEW_UNTIL);
  const base={...query,adapterId:this.id,complete,coverageSource:c.source};
  if(!complete)return {...base,rules:[]};
  const periods=paymentSegments(query);
  const paidMinutes=periods.filter(p=>p.paid).reduce((n,p)=>n+(Date.parse(p.end)-Date.parse(p.start))/60000,0);
  if(paidMinutes>600)return {...base,complete:false,rules:[]};
  return {...base,rules:periods.map((p,i)=>({...query,...p,id:`${c.zoneId}:uno:${i}`,scope:'GENERAL' as const,effect:p.paid?'CONDITIONAL' as const:'ALLOWED' as const,
   conditions:p.paid?['Paiement du stationnement visiteur requis.']:[],source:c.source}))};
 }
}
