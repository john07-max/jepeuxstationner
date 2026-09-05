import type { GeocodingCache,GeocodingResult } from '../../../domain/src/geocoding.js';
interface Entry {value:GeocodingResult[];expiresAt:number;timer:ReturnType<typeof setTimeout>}
/** Ephemeral bounded cache. TTL timers also delete idle entries, not just on reads. */
export class MemoryGeocodingCache implements GeocodingCache {
 private readonly entries=new Map<string,Entry>();
 constructor(private readonly maxEntries=500,private readonly now:()=>number=Date.now) {
  if(!Number.isInteger(maxEntries)||maxEntries<1) throw new RangeError('Invalid cache capacity');
 }
 async get(key:string):Promise<GeocodingResult[]|undefined>{
  const e=this.entries.get(key);if(!e)return undefined;
  if(this.now()>=e.expiresAt){this.remove(key);return undefined;}
  this.entries.delete(key);this.entries.set(key,e);return structuredClone(e.value);
 }
 async set(key:string,value:GeocodingResult[],ttlMs:number):Promise<void>{
  this.remove(key);if(ttlMs<=0)return;
  if(!Number.isFinite(ttlMs)||ttlMs>604800000)throw new RangeError('Invalid cache TTL');
  while(this.entries.size>=this.maxEntries){const first=this.entries.keys().next().value;if(first!==undefined)this.remove(first);}
  const timer=setTimeout(()=>this.remove(key),ttlMs);timer.unref();
  this.entries.set(key,{value:structuredClone(value),expiresAt:this.now()+ttlMs,timer});
 }
 private remove(key:string):void {const e=this.entries.get(key);if(e)clearTimeout(e.timer);this.entries.delete(key);}
 async clear():Promise<void>{for(const key of this.entries.keys())this.remove(key);}
}
