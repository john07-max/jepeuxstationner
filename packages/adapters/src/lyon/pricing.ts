import type { Period } from '../../../domain/src/index.js';
import type { ParkingPricing, ParkingTariffSchedule, VehicleProfile } from '../../../domain/src/local-parking.js';
import { LYON_TARIFF } from './config.js';
import { paymentSegments, parisParts } from './calendar.js';
export function visitorRateClass(vehicle?:VehicleProfile):'REDUCED'|'STANDARD'|'INCREASED'|undefined {
 if(!vehicle||vehicle.vehicleType!=='CAR'||!vehicle.energy||!['THERMAL','PLUGIN_HYBRID','ELECTRIC'].includes(vehicle.energy)||!Number.isFinite(vehicle.weightKg)||(vehicle.weightKg??0)<=0)return undefined;
 const weight=vehicle.weightKg!;
 if(vehicle.energy==='ELECTRIC')return weight<=2100?'REDUCED':'INCREASED';
 if(weight<=1000)return 'REDUCED';
 return weight<=(vehicle.energy==='PLUGIN_HYBRID'?1900:1525)?'STANDARD':'INCREASED';
}
export class LyonParkingPricingEngine {
 constructor(private readonly schedule:ParkingTariffSchedule=LYON_TARIFF){}
 evaluate(period:Period,documented:boolean,vehicle?:VehicleProfile):ParkingPricing {
  if(!documented||Date.parse(period.start)<Date.parse(this.schedule.effectiveFrom))return {status:'UNKNOWN',explanation:'Couverture ou tarif non vérifié.'};
  try {
   const segments=paymentSegments(period),current=segments[0]!;
   const paid=segments.filter(s=>s.paid);
   const rateClass=visitorRateClass(vehicle);
   const base:ParkingPricing={status:current.paid?'PAID':'FREE',validUntil:current.end,explanation:current.paid?'Paiement requis ; montant selon le véhicule.':'Gratuit actuellement selon le calendrier UNO.',source:this.schedule.source};
   if(!paid.length)return {...base,amount:0,currency:'EUR'};
   const minutes=paid.reduce((n,s)=>n+(Date.parse(s.end)-Date.parse(s.start))/60000,0);
   // No undocumented interpolation, accumulation over multiple paid days or invented vehicle class.
   const day=parisParts(Date.parse(paid[0]!.start)).day;
   if(!rateClass||paid.some(s=>parisParts(Date.parse(s.end)-1).day!==day))return base;
   const index=this.schedule.minutes.indexOf(minutes),amount=this.schedule.rates[rateClass][index];
   return {...base,rateClass,...(amount===undefined?{}:{amount,currency:'EUR' as const}),explanation:base.explanation+' Montant éventuel pour la durée demandée, aux paliers publiés uniquement.'};
  }catch{return {status:'UNKNOWN',explanation:'Durée ou calendrier non pris en charge.'};}
 }
}
