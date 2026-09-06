import Holidays from 'date-holidays';
import { instant } from '../../../engine/src/index.js';
import type { Period } from '../../../domain/src/index.js';
export interface PaymentSegment { start:string; end:string; paid:boolean }
/** Dated, explicitly sourced exception. Conflicting exceptions fail closed. */
export interface PaymentException extends Period { paid:boolean; sourceUrl:string; eligibilityConfirmed:boolean }
const holidays=new Holidays('FR',{timezone:'Europe/Paris',types:['public']});
const cache=new Map<number,Set<string>>();
const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
export function parisParts(ms:number):{day:string;hour:number;weekday:number} {
 const p=Object.fromEntries(formatter.formatToParts(ms).map(x=>[x.type,x.value]));
 const day=`${p['year']}-${p['month']}-${p['day']}`;
 return {day,hour:Number(p['hour']),weekday:new Date(day+'T12:00:00Z').getUTCDay()};
}
export function isFrenchHoliday(day:string):boolean {
 const year=Number(day.slice(0,4));
 if(!cache.has(year)) { if(cache.size>=8)cache.clear();cache.set(year,new Set(holidays.getHolidays(year).filter(h=>h.type==='public').map(h=>h.date.slice(0,10)))); }
 return cache.get(year)!.has(day);
}
export function paymentSegments(period:Period, exceptions:readonly PaymentException[]=[]):PaymentSegment[] {
 const a=instant(period.start),b=instant(period.end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>86400000)throw new Error('Unsupported stay: positive duration up to 24 hours required');
 for(const e of exceptions)if(!e.sourceUrl.startsWith('https://')||!(instant(e.start)<instant(e.end)))throw new Error('Invalid dated exception');
 const points=[a,b];
 // Paris payment and calendar boundaries occur at integral UTC hours, including DST.
 for(let t=Math.floor(a/3600000)*3600000+3600000;t<b;t+=3600000)points.push(t);
 for(const e of exceptions)for(const t of [instant(e.start),instant(e.end)])if(t>a&&t<b)points.push(t);
 const sorted=[...new Set(points)].sort((x,y)=>x-y),out:PaymentSegment[]=[];
 for(let i=0;i<sorted.length-1;i++) {
  const start=sorted[i]!,end=sorted[i+1]!,p=parisParts(start);
  const overrides=exceptions.filter(e=>e.eligibilityConfirmed&&instant(e.start)<=start&&instant(e.end)>=end);
  if(new Set(overrides.map(e=>e.paid)).size>1)throw new Error('Conflicting dated exceptions');
  const paid=overrides[0]?.paid ?? (p.weekday!==0&&!isFrenchHoliday(p.day)&&p.hour>=9&&p.hour<19);
  const previous=out.at(-1);
  if(previous&&previous.paid===paid)previous.end=new Date(end).toISOString();
  else out.push({start:new Date(start).toISOString(),end:new Date(end).toISOString(),paid});
 }
 return out;
}
