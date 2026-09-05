import { DiaLogError, DIALOG_ENDPOINT, silentMetric } from './types.js';
import type { Metric } from './types.js';
import { parseDiaLog } from './parser.js';
import type { ParsedDiaLog } from './parser.js';
export interface DiaLogHttpOptions { timeoutMs?:number; retries?:number; maxBytes?:number; freshnessMs?:number; metric?:Metric; fetch?:typeof fetch; }
export class DiaLogHttpClient {
 constructor(private readonly options:DiaLogHttpOptions={}){}
 async download(retrievedAt:string, signal?:AbortSignal):Promise<ParsedDiaLog> {
  const {timeoutMs=60000,retries=1,maxBytes=128*1024*1024,freshnessMs=86400000,metric=silentMetric}=this.options;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isInteger(retries)||retries<0||retries>2)throw new DiaLogError('CONFIG');
  const url=new URL(DIALOG_ENDPOINT);url.search=new URLSearchParams({includePermanent:'true',includeTemporary:'true',includeExpired:'false'}).toString();
  for(let attempt=0;;attempt++) {
   const controller=new AbortController();const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
   const timer=setTimeout(()=>controller.abort(),timeoutMs);
   try {
    const request=async()=>{
     const response=await (this.options.fetch??fetch)(url,{signal:combined,redirect:'error',headers:{Accept:'application/xml','User-Agent':'JePeuxStationner/phase2'}});
     if(!response.ok){await response.body?.cancel();if(response.status===429){const h=response.headers.get('retry-after');const n=Number(h);const wait=h?(Number.isFinite(n)?n*1000:Date.parse(h)-Date.now()):1000;throw new DiaLogError('RATE_LIMITED',Math.max(1000,Number.isFinite(wait)?wait:1000));}throw new DiaLogError(response.status>=500?'NETWORK':'HTTP');}
     if(!response.body)throw new DiaLogError('HTTP');
     return parseDiaLog(response.body as unknown as AsyncIterable<Uint8Array>,retrievedAt,{maxBytes,freshnessMs,metric});
    };
    const aborted=new Promise<never>((_,reject)=>{const fail=()=>reject(new DiaLogError('TIMEOUT'));if(combined.aborted)fail();else combined.addEventListener('abort',fail,{once:true});});
    const result=await Promise.race([request(),aborted]);metric('dialog.fetch.success',1);return result;
   }catch(error){const e=error instanceof DiaLogError?error:new DiaLogError(combined.aborted?'TIMEOUT':'NETWORK');metric('dialog.fetch.failure',1);
    // 429 is surfaced with Retry-After; never hammer the public producer or wait unboundedly.
    if(signal?.aborted||attempt>=retries||!['NETWORK','TIMEOUT'].includes(e.code))throw e;
   }finally{clearTimeout(timer);controller.abort();}
   await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
 }
}
