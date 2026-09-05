import { GeocodingCancelledError,normalizeGeocodingQuery } from '../../../domain/src/geocoding.js';
import type { AutocompleteOptions,GeocodingProvider,GeocodingSuggestion } from '../../../domain/src/geocoding.js';
/** One controller per consumer (input field). Catch CANCELLED without rendering an error. */
export class DebouncedGeocodingAutocomplete {
 private pending:{controller:AbortController;timer:ReturnType<typeof setTimeout>;reject:(e:Error)=>void}|undefined;
 constructor(private readonly provider:GeocodingProvider,private readonly delayMs=300,private readonly minimumChars=3){
  if(!Number.isInteger(delayMs)||delayMs<1||!Number.isInteger(minimumChars)||minimumChars<3)throw new RangeError('Invalid debounce configuration');
 }
 cancel():void {if(this.pending){const p=this.pending;this.pending=undefined;clearTimeout(p.timer);p.controller.abort();p.reject(new GeocodingCancelledError());}}
 async suggest(query:string,options:AutocompleteOptions={}):Promise<GeocodingSuggestion[]>{
  this.cancel();const normalized=normalizeGeocodingQuery(query);
  if(options.signal?.aborted)throw new GeocodingCancelledError();
  if(normalized.length<this.minimumChars)return [];
  const controller=new AbortController();const signal=options.signal?AbortSignal.any([controller.signal,options.signal]):controller.signal;
  return new Promise((resolve,reject)=>{
   const cleanup=():void=>{signal.removeEventListener('abort',aborted);if(this.pending?.controller===controller)this.pending=undefined;};
   const aborted=():void=>{clearTimeout(timer);cleanup();reject(new GeocodingCancelledError());};
   const timer=setTimeout(()=>{
    void this.provider.autocomplete(normalized,{...options,signal}).then(
     results=>{if(signal.aborted){cleanup();reject(new GeocodingCancelledError());}else{cleanup();resolve(results);}},
     error=>{cleanup();reject(error);});
   },this.delayMs);
   this.pending={controller,timer,reject};signal.addEventListener('abort',aborted,{once:true});
  });
 }
}
