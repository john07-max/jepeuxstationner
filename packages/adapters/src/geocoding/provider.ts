import { coordinates,GeocodingResponseError,InvalidGeocodingQueryError,normalizeGeocodingQuery } from '../../../domain/src/geocoding.js';
import type { GeocodingCache,GeocodingProvider,GeocodingResult,GeocodingSearchOptions,GeographicBounds } from '../../../domain/src/geocoding.js';
import { defaultGeocodingConfig,validateConfig } from './config.js';
import type { GeocodingConfig } from './config.js';
import { MemoryGeocodingCache } from './cache.js';
import { checkCancelled,GeocodingHttpClient,sharedRequestGate,systemClock } from './transport.js';
import type { Clock,FetchLike,GeocodingRequestGate } from './transport.js';
const record=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
function optionalText(p:Record<string,unknown>,name:string):string|undefined{
 const value=p[name];if(value===undefined||value===null)return undefined;
 if(typeof value!=='string')throw new GeocodingResponseError();return value;
}
export function normalizeGeoPlatformResponse(payload:unknown):GeocodingResult[]{
 if(!record(payload)||payload['type']!=='FeatureCollection'||!Array.isArray(payload['features']))throw new GeocodingResponseError();
 return payload['features'].map((f:unknown)=>{
  if(!record(f)||f['type']!=='Feature'||!record(f['geometry'])||!record(f['properties']))throw new GeocodingResponseError();
  const g=f['geometry'],p=f['properties'],position=g['coordinates'];
  if(g['type']!=='Point'||!Array.isArray(position)||position.length!==2||typeof position[0]!=='number'||typeof position[1]!=='number')throw new GeocodingResponseError();
  let c;try{c=coordinates(position[1],position[0]);}catch{throw new GeocodingResponseError();}
  if(typeof p['label']!=='string'||!p['label'].trim())throw new GeocodingResponseError();
  const result:GeocodingResult={label:p['label'],coordinates:c,provider:'geoplateforme-ban'};
  const texts=[['id','id'],['postcode','postcode'],['city','city'],['cityCode','citycode'],['street','street'],['housenumber','housenumber']] as const;
  const extra:Record<string,string|number>={};
  for(const [target,key]of texts){const value=optionalText(p,key);if(value!==undefined)extra[target]=value;}
  for(const [target,key]of [['score','score'],['distanceMeters','distance']] as const){
   const n=p[key];if(n!==undefined&&n!==null){if(typeof n!=='number'||!Number.isFinite(n)||n<0)throw new GeocodingResponseError();extra[target]=n;}
  }
  const kind=p['type'];
  if(kind!==undefined&&(typeof kind!=='string'||!['housenumber','street','locality','municipality'].includes(kind)))throw new GeocodingResponseError();
  return {...result,...extra,...(kind===undefined?{}:{precision:kind as GeocodingResult['precision']})} as GeocodingResult;
 });
}
function validateBounds(b:GeographicBounds):void{
 coordinates(b.south,b.west);coordinates(b.north,b.east);
 if(b.south>b.north||b.west>b.east)throw new InvalidGeocodingQueryError();
}
export interface GeoPlatformDependencies {fetcher?:FetchLike;cache?:GeocodingCache;gate?:GeocodingRequestGate;clock?:Clock}
export class GeoPlatformGeocodingProvider implements GeocodingProvider {
 readonly config:GeocodingConfig;
 private readonly cache:GeocodingCache;private readonly http:GeocodingHttpClient;
 constructor(config:Partial<GeocodingConfig>={},deps:GeoPlatformDependencies={}){
  this.config=validateConfig({...defaultGeocodingConfig,...config});
  this.cache=deps.cache??new MemoryGeocodingCache(this.config.cacheMaxEntries);
  this.http=new GeocodingHttpClient(this.config,deps.gate??sharedRequestGate(this.config.baseUrl,this.config.ratePerSecond),deps.fetcher,deps.clock??systemClock);
 }
 search(query:string,options:GeocodingSearchOptions={}):Promise<GeocodingResult[]>{return this.forward(query,false,options);}
 autocomplete(query:string,options:GeocodingSearchOptions={}):Promise<GeocodingResult[]>{return this.forward(query,true,options);}
 private async forward(query:string,autocomplete:boolean,o:GeocodingSearchOptions):Promise<GeocodingResult[]>{
  checkCancelled(o.signal);const q=normalizeGeocodingQuery(query);
  const limit=o.limit??this.config.defaultResults;
  if(!Number.isInteger(limit)||limit<1)throw new InvalidGeocodingQueryError();
  const count=Math.min(limit,this.config.maxResults);
  const url=new URL('search',this.config.baseUrl);
  url.searchParams.set('q',q);url.searchParams.set('index','address');url.searchParams.set('autocomplete',autocomplete?'1':'0');
  url.searchParams.set('limit',String(o.bounds?50:count));
  for(const [key,value,pattern]of [
   ['depcode',o.departmentCode,/^(?:\d{2,3}|2[AB])$/u],['citycode',o.cityCode,/^(?:\d{5}|2[AB]\d{3})$/u],['postcode',o.postcode,/^\d{5}$/u],
  ] as const){if(value!==undefined){if(typeof value!=='string'||!pattern.test(value))throw new InvalidGeocodingQueryError();url.searchParams.set(key,value);}}
  if(o.city!==undefined){const city=normalizeGeocodingQuery(o.city);if(!city)throw new InvalidGeocodingQueryError();url.searchParams.set('city',city);}
  if(o.bounds)validateBounds(o.bounds);
  const near=o.near??(o.bounds?{latitude:(o.bounds.south+o.bounds.north)/2,longitude:(o.bounds.west+o.bounds.east)/2}:undefined);
  if(near){coordinates(near.latitude,near.longitude);url.searchParams.set('lat',String(near.latitude));url.searchParams.set('lon',String(near.longitude));}
  if(autocomplete&&q.length<this.config.minAutocompleteChars)return [];
  if(q.length<2)throw new InvalidGeocodingQueryError();
  const key=JSON.stringify(['v1',url.toString(),count,o.bounds?[o.bounds.west,o.bounds.south,o.bounds.east,o.bounds.north]:null]);
  return this.cached(key,url,count,o.bounds,o.signal);
 }
 async reverse(latitude:number,longitude:number,options:{signal?:AbortSignal}={}):Promise<GeocodingResult|null>{
  checkCancelled(options.signal);coordinates(latitude,longitude);
  const url=new URL('reverse',this.config.baseUrl);
  url.searchParams.set('lat',String(latitude));url.searchParams.set('lon',String(longitude));
  url.searchParams.set('index','address');url.searchParams.set('limit','1');
  return (await this.cached(JSON.stringify(['v1',url.toString()]),url,1,undefined,options.signal))[0]??null;
 }
 private async cached(key:string,url:URL,limit:number,bounds:GeographicBounds|undefined,signal?:AbortSignal):Promise<GeocodingResult[]>{
  const cached=await this.cache.get(key);checkCancelled(signal);if(cached!==undefined)return cached;
  const all=normalizeGeoPlatformResponse(await this.http.json(url,signal));checkCancelled(signal);
  const results=all.filter(r=>!bounds||(r.coordinates.longitude>=bounds.west&&r.coordinates.longitude<=bounds.east&&r.coordinates.latitude>=bounds.south&&r.coordinates.latitude<=bounds.north)).slice(0,limit);
  await this.cache.set(key,results,results.length?this.config.cacheTtlMs:this.config.emptyCacheTtlMs);
  checkCancelled(signal);return results;
 }
}
