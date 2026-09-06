import {coordinates} from '../../../packages/domain/src/geocoding.js';
import {instant} from '../../../packages/engine/src/index.js';
import type {VehicleProfile} from '../../../packages/domain/src/local-parking.js';
export class ApiError extends Error {constructor(readonly status:number,readonly code:string,message:string){super(message);}}
export interface CheckInput {latitude:number;longitude:number;start:string;end:string;vehicle?:VehicleProfile}
const bad=()=>new ApiError(400,'INVALID_INPUT','Vérifiez la position, la période et les caractéristiques du véhicule.');
function object(x:unknown):x is Record<string,unknown>{return x!==null&&typeof x==='object'&&!Array.isArray(x);}
export function validateCheck(value:unknown,now:number):CheckInput {
 if(!object(value)||Object.keys(value).some(k=>!['latitude','longitude','start','end','vehicle'].includes(k)))throw bad();
 const {latitude,longitude,start,end,vehicle}=value;
 if(typeof latitude!=='number'||typeof longitude!=='number'||typeof start!=='string'||typeof end!=='string')throw bad();
 try{coordinates(latitude,longitude);}catch{throw bad();}
 const a=instant(start),b=instant(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>86400000||a<now-300000||a>now+7*86400000)throw bad();
 if(vehicle!==undefined){
  if(!object(vehicle)||Object.keys(vehicle).some(k=>!['vehicleType','energy','weightKg'].includes(k))||!['CAR','OTHER'].includes(String(vehicle['vehicleType'])))throw bad();
  if(vehicle['energy']!==undefined&&!['THERMAL','PLUGIN_HYBRID','ELECTRIC'].includes(String(vehicle['energy'])))throw bad();
  if(vehicle['weightKg']!==undefined&&(typeof vehicle['weightKg']!=='number'||!Number.isFinite(vehicle['weightKg'])||vehicle['weightKg']<=0||vehicle['weightKg']>10000))throw bad();
 }
 return {latitude,longitude,start,end,...(vehicle?{vehicle:vehicle as unknown as VehicleProfile}:{})};
}
export function queryCoordinates(params:URLSearchParams):{latitude:number;longitude:number} {
 const lat=params.get('latitude'),lon=params.get('longitude');
 if(!lat?.trim()||!lon?.trim())throw bad();
 try{return coordinates(Number(lat),Number(lon));}catch{throw bad();}
}
