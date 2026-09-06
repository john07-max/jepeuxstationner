import type pg from 'pg';
import type { GeocodingProvider } from '../../domain/src/geocoding.js';
import { CheckParkingService } from './check-parking.js';
import { resolveLyonContext,findNearbyParkingFacilities } from '../../database/src/lyon.js';
import { databaseDiaLogAdapter } from '../../database/src/dialog.js';
import { LyonParkingDataSourceAdapter } from '../../adapters/src/lyon/adapter.js';
import { LyonParkingPricingEngine } from '../../adapters/src/lyon/pricing.js';
export function createLyonCheckParkingService(client:pg.Client,geocoder:GeocodingProvider):CheckParkingService {
 const pricing=new LyonParkingPricingEngine();
 return new CheckParkingService({geocoder,resolve:(p,t,n)=>resolveLyonContext(client,p,t,n),
  adapters:(context,p)=>[new LyonParkingDataSourceAdapter(context.coverage),databaseDiaLogAdapter(client,p.longitude,p.latitude)],
  pricing:(p,c,v)=>pricing.evaluate(p,c,v),nearby:(p,r,l,n)=>findNearbyParkingFacilities(client,p,r,l,n)});
}
