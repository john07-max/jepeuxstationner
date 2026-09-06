/** Explicit fictional demo; never imported by the production server. */
import {basename} from 'node:path';
import type {ApiDependencies} from '../../apps/web/server/api.js';
import {webServer} from '../../apps/web/server/server.js';
import {CheckParkingService} from '../../packages/application/src/check-parking.js';
import type {GeocodingResult} from '../../packages/domain/src/geocoding.js';
import type {SourceEvidence,RuleSnapshot} from '../../packages/domain/src/index.js';
export function demoDependencies():ApiDependencies {
 const locations:GeocodingResult[]=['Interdit','Conditionnel','Autorisé','Inconnu','Erreur','Paris'].map((name,i)=>({label:`${name} · adresse fictive ${i+1}, Lyon`,provider:'fixture',id:String(i),precision:'housenumber',coordinates:{latitude:45.76,longitude:4.83+i/1000}}));
 const geocoder={async search(){return locations;},async autocomplete(q:string){return locations.filter(l=>l.label.toLocaleLowerCase('fr').includes(q.toLocaleLowerCase('fr')));},async reverse(){return locations[0]!;}};
 return {geocoder,async ready(){return true;},async inCity(p){return p.longitude<4.8345&&p.longitude>4.7&&p.latitude>45.6&&p.latitude<45.9;},
  async check(input,now){
   const idx=Math.round((input.longitude-4.83)*1000);if(idx===4)throw new Error('Fictional service unavailable');
   const source:SourceEvidence={id:'fixture-web',adapterId:'fixture-web',reference:'https://www.lyon.fr',version:'fictional',authority:'OFFICIAL',kind:'ORDER',synthetic:true,observedAt:now,freshUntil:new Date(Date.parse(now)+86400000).toISOString(),notice:'DÉMONSTRATION : données entièrement fictives.'};
   const app=new CheckParkingService({geocoder,
    async resolve(_p,period){if(idx===3)return undefined;return {query:{...period,cityId:'lyon',zoneId:'fixture'},coverage:{cityId:'lyon',zoneId:'fixture',status:'DOCUMENTED',markedSpaceVerified:true,ambiguous:false,regime:'UNO',source}};},
    adapters:c=>[{id:'fixture-web',async load(){const q=c.query,banStart=idx===1?new Date(Date.parse(q.start)+7200000).toISOString():q.start;
     const snapshot:RuleSnapshot={...q,adapterId:'fixture-web',complete:true,coverageSource:source,rules:[{...q,id:'general',scope:'GENERAL',effect:'ALLOWED',conditions:[],source},...(idx===0||idx===1&&Date.parse(banStart)<Date.parse(q.end)?[{...q,start:banStart,id:'ban',effect:'FORBIDDEN' as const,conditions:[],source}]:[])]};return snapshot;}}],
    pricing:(_p,documented)=>({status:documented?'PAID':'UNKNOWN',explanation:'Tarif fictif ; aucun montant réel.'}),
    async nearby(){return [120,280,440].map((distanceMeters,i)=>({id:'fixture-'+i,externalId:String(i),name:['Parking République · fictif','Parking des quais · fictif','Parking Centre · fictif'][i]!,coordinates:{latitude:45.762+i*0.001,longitude:4.831},publicAccess:true,distanceMeters,sourceUrl:'https://data.grandlyon.com',source:{id:'fixture',url:'https://data.grandlyon.com',licence:'synthetic',version:'fixture',retrievedAt:now},realtime:'UNKNOWN' as const}));}});
   return app.checkPosition(input,input,now,input.vehicle);
  }};
}
if(basename(process.argv[1]??'')==='web-demo.js'){
 const port=Number(process.env['PORT']??4174),origin=process.env['APP_ORIGIN']??'http://localhost:4173';
 const server=webServer(demoDependencies(),origin);server.listen(port,'0.0.0.0',()=>console.log('Fictional web demo ready'));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
}
