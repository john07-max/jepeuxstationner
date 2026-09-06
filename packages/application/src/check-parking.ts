import type { Coordinates, GeocodingProvider } from '../../domain/src/geocoding.js';
import type { DataSourceAdapter, Period } from '../../domain/src/index.js';
import type { ParkingCheckResult, ParkingContext, ParkingPricing, VehicleProfile, NearbyParkingFacility } from '../../domain/src/local-parking.js';
import { ParkingDecisionEngine, decide } from '../../engine/src/index.js';
export interface CheckParkingDependencies {
 geocoder:GeocodingProvider;
 resolve(position:Coordinates,period:Period,now:string):Promise<ParkingContext|undefined>;
 adapters(context:ParkingContext,position:Coordinates):readonly DataSourceAdapter[];
 pricing(period:Period,documented:boolean,vehicle?:VehicleProfile):ParkingPricing;
 nearby(position:Coordinates,radius:number,limit:number,now:string):Promise<NearbyParkingFacility[]>;
}
export class CheckParkingService {
 constructor(private readonly dependencies:CheckParkingDependencies){}
 async check(address:string,period:Period,now:string,vehicle?:VehicleProfile):Promise<ParkingCheckResult> {
  const unknown:ParkingCheckResult={location:null,decision:new ParkingDecisionEngine().evaluate({...period,cityId:'unknown',zoneId:'unknown'},[],now),conditions:[],pricing:{status:'UNKNOWN',explanation:'Aucune couverture suffisamment fiable.'},confidence:'UNKNOWN',sources:[],nearbyParkings:[],dataFreshness:'UNKNOWN',warnings:[]};
  try {
   if(vehicle?.vehicleType==='OTHER')return {...unknown,warnings:['Le pilote prend uniquement en charge les voitures visiteuses.']};
   const locations=await this.dependencies.geocoder.search(address,{limit:2});
   if(locations.length!==1)return {...unknown,warnings:['Adresse absente ou ambiguë.']};
   const location=locations[0]!;
   if(location.precision!=='housenumber'&&location.precision!=='street')return {...unknown,location,warnings:['Précision géographique insuffisante.']};
   const context=await this.dependencies.resolve(location.coordinates,period,now);
   if(!context)return {...unknown,location,warnings:['Position hors emplacement documenté ou proche de plusieurs zones.']};
   const decision=await decide(context.query,this.dependencies.adapters(context,location.coordinates),now);
   const permitted=decision.status==='ALLOWED'||decision.status==='CONDITIONAL';
   const pricing=this.dependencies.pricing({...period,end:decision.allowedUntil??period.end},permitted,vehicle);
   let nearbyParkings:NearbyParkingFacility[]=[];const warnings:string[]=[decision.notice];
   if(decision.status==='FORBIDDEN')try{nearbyParkings=await this.dependencies.nearby(location.coordinates,1500,3,now);}catch{warnings.push('Recherche de parkings temporairement indisponible.');}
   return {location,decision,...(decision.allowedUntil?{allowedUntil:decision.allowedUntil}:{}),conditions:[...new Set(decision.segments.flatMap(s=>s.conditions))],pricing,
    confidence:decision.status==='UNKNOWN'?'UNKNOWN':'DOCUMENTED',sources:decision.evidence,nearbyParkings,dataFreshness:decision.status==='UNKNOWN'?'UNKNOWN':'CURRENT',warnings};
  }catch{return {...unknown,warnings:['Vérification indisponible ; aucune autorisation déduite.']};}
 }
}
