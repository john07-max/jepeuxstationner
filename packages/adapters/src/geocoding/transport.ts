import { GeocodingCancelledError,GeocodingError,GeocodingRateLimitError,GeocodingResponseError,GeocodingTimeoutError,GeocodingUnavailableError,InvalidGeocodingQueryError } from '../../../domain/src/geocoding.js';
import type { GeocodingConfig } from './config.js';
export interface Clock {now():number;sleep(ms:number,signal?:AbortSignal):Promise<void>}
export function checkCancelled(signal?:AbortSignal):void {if(signal?.aborted)throw new GeocodingCancelledError();}
export const systemClock:Clock={now:Date.now,sleep(ms,signal){
 checkCancelled(signal);
 return new Promise((resolve,reject)=>{
  const abort=():void=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new GeocodingCancelledError());};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}};
export class GeocodingRequestGate {
 private nextAt=0;private blockedUntil=0;
 constructor(private ratePerSecond:number,private readonly clock:Clock=systemClock){
  if(!Number.isInteger(ratePerSecond)||ratePerSecond<1||ratePerSecond>20)throw new RangeError('Invalid request rate');
 }
 limitTo(rate:number):void {this.ratePerSecond=Math.min(this.ratePerSecond,rate);}
 blockFor(ms:number):void {this.blockedUntil=Math.max(this.blockedUntil,this.clock.now()+ms);}
 async acquire(maxWaitMs:number,signal?:AbortSignal):Promise<void>{
  const deadline=this.clock.now()+maxWaitMs;
  for(;;){
   checkCancelled(signal);const now=this.clock.now();
   if(now<this.blockedUntil)throw new GeocodingRateLimitError(this.blockedUntil-now);
   const wait=Math.max(0,this.nextAt-now);
   if(wait===0){this.nextAt=now+Math.ceil(1000/this.ratePerSecond);return;}
   if(now+wait>deadline)throw new GeocodingRateLimitError(wait);
   await this.clock.sleep(wait,signal);
  }
 }
}
const gates=new Map<string,GeocodingRequestGate>();
export function sharedRequestGate(baseUrl:string,rate:number):GeocodingRequestGate {
 const origin=new URL(baseUrl).origin;let gate=gates.get(origin);
 if(!gate){gate=new GeocodingRequestGate(rate);gates.set(origin,gate);}else gate.limitTo(rate);
 return gate;
}
export function retryAfterMs(header:string|null,now:number,fallback:number):number {
 if(header===null)return fallback;
 if(/^\d+(?:\.\d+)?$/u.test(header.trim())){
  const n=Number(header)*1000;if(Number.isFinite(n))return Math.ceil(n);
 }
 if(!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/u.test(header))return fallback;
 const date=Date.parse(header);return Number.isFinite(date)?Math.max(0,date-now):fallback;
}
class TemporaryHttpError extends GeocodingUnavailableError {}
export type FetchLike=(url:URL,init:RequestInit)=>Promise<Response>;
/** The only production fetch call for geocoding is in this transport. */
export class GeocodingHttpClient {
 constructor(private readonly config:GeocodingConfig,private readonly gate:GeocodingRequestGate,
  private readonly fetcher:FetchLike=(url,init)=>fetch(url,init),private readonly clock:Clock=systemClock){}
 async json(url:URL,signal?:AbortSignal):Promise<unknown>{
  for(let attempt=0;;attempt++){
   await this.gate.acquire(this.config.maxQueueWaitMs,signal);
   try{return await this.attempt(url,signal);}
   catch(error){
    checkCancelled(signal);
    const retry=error instanceof TemporaryHttpError||error instanceof GeocodingTimeoutError;
    if(!retry||attempt>=this.config.maxRetries)throw error;
    await this.clock.sleep(this.config.retryBaseMs*2**attempt,signal);
   }
  }
 }
 private async attempt(url:URL,signal?:AbortSignal):Promise<unknown>{
  checkCancelled(signal);const controller=new AbortController();
  const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  let timer:ReturnType<typeof setTimeout>|undefined;let onAbort:()=>void=()=>{};
  const cancelled=new Promise<never>((_,reject)=>{
   onAbort=()=>reject(signal?.aborted?new GeocodingCancelledError():new GeocodingTimeoutError());
   combined.addEventListener('abort',onAbort,{once:true});
   timer=setTimeout(()=>controller.abort(),this.config.timeoutMs);
  });
  const operation=async():Promise<unknown>=>{
   let response:Response;
   try {response=await this.fetcher(url,{signal:combined,headers:{Accept:'application/json'},redirect:'error'});}
   catch {checkCancelled(signal);if(controller.signal.aborted)throw new GeocodingTimeoutError();throw new TemporaryHttpError();}
   if(response.status===429){
    const ms=retryAfterMs(response.headers.get('Retry-After'),this.clock.now(),this.config.defaultRetryAfterMs);
    this.gate.blockFor(ms);void response.body?.cancel().catch(()=>{});throw new GeocodingRateLimitError(ms);
   }
   if(!response.ok){
    void response.body?.cancel().catch(()=>{});
    if(response.status===400||response.status===404)throw new InvalidGeocodingQueryError();
    if([502,503,504].includes(response.status))throw new TemporaryHttpError();
    throw new GeocodingUnavailableError();
   }
   try {
    const body=await response.text();
    if(body.length>1000000)throw new GeocodingResponseError();
    return JSON.parse(body) as unknown;
   } catch(error){if(error instanceof GeocodingError)throw error;throw new GeocodingResponseError();}
  };
  try{return await Promise.race([operation(),cancelled]);}
  finally {if(timer)clearTimeout(timer);combined.removeEventListener('abort',onAbort);controller.abort();}
 }
}
