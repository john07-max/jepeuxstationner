export class ClientError extends Error {constructor(readonly code:string,message:string){super(message);}}
export async function api<T>(url:string,options:RequestInit={}):Promise<T> {
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try {
  const response=await fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,headers:{'Content-Type':'application/json',...options.headers}});
  const body=await response.json() as {error?:{code:string;message:string}};
  if(!response.ok)throw new ClientError(body.error?.code??'UNAVAILABLE',body.error?.message??'Impossible de vérifier les règles pour le moment.');
  return body as T;
 }catch(e){if(e instanceof ClientError)throw e;throw new ClientError('NETWORK','Impossible de vérifier les règles pour le moment. Réessayez dans quelques instants.');}
 finally{clearTimeout(timeout);}
}
/** Interface only; no collector, addresses, position, cookies or persistent event history. */
export type AnonymousEvent='parking_check'|'decision_allowed'|'decision_conditional'|'decision_forbidden'|'decision_unknown'|'geolocation_used'|'nearby_parking_clicked';
export function emit(_event:AnonymousEvent):void {/* No external analytics in phase 4. */}
