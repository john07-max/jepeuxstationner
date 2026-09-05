import { GeocodingConfigurationError } from '../../../domain/src/geocoding.js';
export interface GeocodingConfig {
 readonly baseUrl:string; readonly timeoutMs:number; readonly cacheTtlMs:number;
 readonly emptyCacheTtlMs:number; readonly cacheMaxEntries:number; readonly ratePerSecond:number;
 readonly maxQueueWaitMs:number; readonly maxRetries:number; readonly retryBaseMs:number;
 readonly defaultRetryAfterMs:number; readonly minAutocompleteChars:number;
 readonly debounceMs:number; readonly maxResults:number; readonly defaultResults:number;
}
export const defaultGeocodingConfig:GeocodingConfig={
 baseUrl:'https://data.geopf.fr/geocodage/',timeoutMs:5000,cacheTtlMs:86400000,
 emptyCacheTtlMs:30000,cacheMaxEntries:500,ratePerSecond:5,maxQueueWaitMs:1000,
 maxRetries:1,retryBaseMs:500,defaultRetryAfterMs:1000,minAutocompleteChars:3,
 debounceMs:300,maxResults:10,defaultResults:5,
};
export function validateConfig(c:GeocodingConfig):GeocodingConfig {
 let url:URL;try {url=new URL(c.baseUrl);}catch {throw new GeocodingConfigurationError();}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname==='api-adresse.data.gouv.fr') throw new GeocodingConfigurationError();
 const ranges:readonly [number,number,number][]=[
 [c.timeoutMs,1,30000],[c.cacheTtlMs,0,604800000],[c.emptyCacheTtlMs,0,60000],
 [c.cacheMaxEntries,1,10000],[c.ratePerSecond,1,20],[c.maxQueueWaitMs,0,5000],
 [c.maxRetries,0,2],[c.retryBaseMs,1,5000],[c.defaultRetryAfterMs,1,60000],
 [c.minAutocompleteChars,3,20],[c.debounceMs,1,2000],[c.maxResults,1,50],[c.defaultResults,1,c.maxResults]];
 if(ranges.some(([n,min,max])=>!Number.isInteger(n)||n<min||n>max)) throw new GeocodingConfigurationError();
 return {...c,baseUrl:url.toString().replace(/\/?$/u,'/')};
}
export function geocodingConfigFromEnv(env:Record<string,string|undefined>):GeocodingConfig {
 const n=(name:string,fallback:number):number=>env[name]===undefined?fallback:Number(env[name]);
 const d=defaultGeocodingConfig;
 return validateConfig({
 baseUrl:env['GEOCODING_BASE_URL']??d.baseUrl,
 timeoutMs:n('GEOCODING_TIMEOUT_MS',d.timeoutMs),cacheTtlMs:n('GEOCODING_CACHE_TTL_MS',d.cacheTtlMs),
 emptyCacheTtlMs:n('GEOCODING_EMPTY_CACHE_TTL_MS',d.emptyCacheTtlMs),cacheMaxEntries:n('GEOCODING_CACHE_MAX_ENTRIES',d.cacheMaxEntries),
 ratePerSecond:n('GEOCODING_RATE_LIMIT',d.ratePerSecond),maxQueueWaitMs:n('GEOCODING_MAX_QUEUE_WAIT_MS',d.maxQueueWaitMs),
 maxRetries:n('GEOCODING_MAX_RETRIES',d.maxRetries),retryBaseMs:n('GEOCODING_RETRY_BASE_MS',d.retryBaseMs),
 defaultRetryAfterMs:n('GEOCODING_DEFAULT_RETRY_AFTER_MS',d.defaultRetryAfterMs),
 minAutocompleteChars:n('GEOCODING_MIN_AUTOCOMPLETE_CHARS',d.minAutocompleteChars),debounceMs:n('GEOCODING_DEBOUNCE_MS',d.debounceMs),
 maxResults:n('GEOCODING_MAX_RESULTS',d.maxResults),defaultResults:n('GEOCODING_DEFAULT_RESULTS',d.defaultResults),
 });
}
