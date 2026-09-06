export const parisFormat=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const partsFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localParis(ms:number):string {const p=Object.fromEntries(partsFormat.formatToParts(ms).map(x=>[x.type,x.value]));return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;}
/** Paris local wall time, rejecting nonexistent/ambiguous DST hours. */
export function parisInstant(local:string):number {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new Error('Choisissez une date et une heure.');
 const base=Date.parse(local+'Z');const matches=[base-3600000,base-7200000].filter(t=>Number.isFinite(t)&&localParis(t)===local);
 if(matches.length!==1)throw new Error('Cette heure est ambiguë ou inexistante au changement d’heure. Choisissez une autre heure.');return matches[0]!;
}
export function periodEnd(choice:string,start:number,custom=''):number {
 if(['1','2','4'].includes(choice))return start+Number(choice)*3600000;
 if(choice==='custom')return parisInstant(custom);
 const hour=choice==='night'?'08:00':'10:00',day=localParis(start).slice(0,10);
 let end=parisInstant(day+'T'+hour);
 if(choice==='morning'||end<=start){const next=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);end=parisInstant(next+'T'+hour);}
 return end;
}
export function displayTime(iso:string):string{return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}
