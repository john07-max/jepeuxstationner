import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeoPlatformGeocodingProvider } from '../../packages/adapters/src/geocoding/provider.js';
import { geocodingConfigFromEnv } from '../../packages/adapters/src/geocoding/config.js';
import type { GeocodingResult } from '../../packages/domain/src/geocoding.js';
// Explicit live-only suite: five public-location requests, no retries or DB.
const config=geocodingConfigFromEnv(process.env);
if(new URL(config.baseUrl).origin!=='https://data.geopf.fr')throw new Error('Live validation requires the official GeoPlatform host');
const provider=new GeoPlatformGeocodingProvider({...config,maxRetries:0,ratePerSecond:2,timeoutMs:10000});
function check(r:GeocodingResult|undefined,latMin:number,latMax:number,lonMin:number,lonMax:number):void{
 assert.ok(r,'A real result is required');assert.ok(r.label.trim());assert.equal(r.provider,'geoplateforme-ban');
 assert.ok(r.coordinates.latitude>=latMin&&r.coordinates.latitude<=latMax,'Latitude within expected French city');
 assert.ok(r.coordinates.longitude>=lonMin&&r.coordinates.longitude<=lonMax,'Longitude within expected French city');
}
for(const [name,query,a,b,c,d] of [
 ['Paris',"1 Place de l'Hôtel de Ville Paris",48.7,49,2.1,2.6],
 ['Lyon','Place Bellecour Lyon',45.6,45.9,4.6,5],
 ['Nantes','44000 Nantes',47.1,47.4,-1.8,-1.3],
] as const)test(`live official search ${name}`,{timeout:15000},async()=>{
 const results=await provider.search(query,{limit:3});check(results[0],a,b,c,d);
 console.log(JSON.stringify({event:'geocoding.live.success',case:name,count:results.length}));
});
test('live official reverse Paris',{timeout:15000},async()=>{
 const r=await provider.reverse(48.8566,2.3522);check(r??undefined,48.7,49,2.1,2.6);console.log('geocoding.live.reverse.success');
});
test('live official autocomplete Lyon',{timeout:15000},async()=>{
 const r=await provider.autocomplete('12 rue vict',{city:'Lyon',limit:3});check(r[0],45.6,45.9,4.6,5);assert.ok(r.length<=3);console.log('geocoding.live.autocomplete.success');
});
