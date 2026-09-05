import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { GeoPlatformGeocodingProvider,normalizeGeoPlatformResponse } from '../packages/adapters/src/geocoding/provider.js';
import { MemoryGeocodingCache } from '../packages/adapters/src/geocoding/cache.js';
import { DebouncedGeocodingAutocomplete } from '../packages/adapters/src/geocoding/autocomplete.js';
import { GeocodingRequestGate,sharedRequestGate,retryAfterMs,systemClock } from '../packages/adapters/src/geocoding/transport.js';
import type { Clock,FetchLike } from '../packages/adapters/src/geocoding/transport.js';
import { geocodingConfigFromEnv } from '../packages/adapters/src/geocoding/config.js';
import type { GeocodingConfig } from '../packages/adapters/src/geocoding/config.js';
import { coordinates,toGeoJsonPosition,normalizeGeocodingQuery,GeocodingCancelledError,GeocodingConfigurationError,GeocodingRateLimitError,GeocodingResponseError,GeocodingTimeoutError,GeocodingUnavailableError,InvalidCoordinatesError,InvalidGeocodingQueryError } from '../packages/domain/src/geocoding.js';
import { collection,feature } from './fixtures/geocoding.js';
class FakeClock implements Clock {
 time=Date.parse('2026-09-05T12:00:00Z');waits:number[]=[];
 now=():number=>this.time;
 async sleep(ms:number,signal?:AbortSignal):Promise<void>{if(signal?.aborted)throw new GeocodingCancelledError();this.waits.push(ms);this.time+=ms;}
}
function setup(fetcher:FetchLike=async()=>Response.json(collection()),config:Partial<GeocodingConfig>={}){
 const clock=new FakeClock();const gate=new GeocodingRequestGate(5,clock);const cache=new MemoryGeocodingCache(500,clock.now);
 const urls:URL[]=[];
 const provider=new GeoPlatformGeocodingProvider({maxRetries:0,...config},{clock,gate,cache,fetcher:async(url,init)=>{urls.push(new URL(url));return fetcher(url,init);}});
 return {provider,urls,clock,gate,cache};
}
const inputCases=['10 rue de la Paix Paris','12 rue vict','Rue Victor Hugo Lyon','Nantes','44000','École République','Saint-Étienne',"Place de l'Hôtel de Ville",'  12   RUE Victor  Hugo  '];
for(const q of inputCases)test(`direct normalizes supported input: ${q}`,async()=>{
 const {provider,urls}=setup();const results=await provider.search(q);
 assert.equal(results.length,1);assert.equal(results[0]?.cityCode,'69382');assert.equal(urls[0]?.searchParams.get('q'),normalizeGeocodingQuery(q));
 assert.equal(urls[0]?.hostname,'data.geopf.fr');assert.equal(urls[0]?.pathname,'/geocodage/search');assert.equal(urls[0]?.searchParams.get('autocomplete'),'0');
});
test('multiple normalized results and no raw payload leak',async()=>{
 const {provider}=setup(async()=>Response.json(collection([feature(),feature('Deuxième résultat')])));
 const result=await provider.search('adresse');assert.equal(result.length,2);assert.equal(result[0]?.provider,'geoplateforme-ban');assert.ok(!JSON.stringify(result).includes('internal_debug'));
});
test('no result is an empty array',async()=>assert.deepEqual(await setup(async()=>Response.json(collection([]))).provider.search('zzzz rue impossible'),[]));
for(const q of ['', ' ', 'x','a'.repeat(201),'abc\u0000def'])test(`invalid search is rejected before HTTP: ${JSON.stringify(q)}`,async()=>{
 const {provider,urls}=setup();await assert.rejects(provider.search(q),InvalidGeocodingQueryError);assert.equal(urls.length,0);
});
for(const [name,payload]of [
 ['missing features',{}],['null collection',null],['wrong collection type',{type:'Thing',features:[]}],
 ['missing label',collection([{...feature(),properties:{}}])],
 ['wrong geometry',collection([{...feature(),geometry:{type:'Polygon',coordinates:[]}}])],
 ['invalid coordinates',collection([feature('bad',2,120)])],
 ['string coordinates',collection([{...feature(),geometry:{type:'Point',coordinates:['2','48']}}])],
 ['bad optional field',collection([{...feature(),properties:{...feature().properties,postcode:69002}}])],
 ['array precision',collection([{...feature(),properties:{...feature().properties,type:['street']}}])],
 ['bad score',collection([{...feature(),properties:{...feature().properties,score:'high'}}])],
 ['one bad feature among valid',collection([feature(),null])],
] as const)test(`malformed response: ${name}`,async()=>{
 await assert.rejects(setup(async()=>Response.json(payload)).provider.search('adresse'),GeocodingResponseError);
});
test('optional score absent is not fabricated',()=>{
 const r=normalizeGeoPlatformResponse(collection([{...feature(),properties:{label:'Commune',type:'municipality'}}]));
 assert.equal(r[0]?.score,undefined);assert.equal(r[0]?.precision,'municipality');
});
test('score zero preserved',()=>assert.equal(normalizeGeoPlatformResponse(collection([{...feature(),properties:{...feature().properties,score:0}}]))[0]?.score,0));
test('autocomplete below three characters makes no HTTP call',async()=>{
 const {provider,urls}=setup();for(const q of ['', 'a',' é '])assert.deepEqual(await provider.autocomplete(q),[]);assert.equal(urls.length,0);
});
test('autocomplete valid accented query, endpoint mode and limit',async()=>{
 const {provider,urls}=setup(async()=>Response.json(collection(Array.from({length:8},()=>feature()))));
 assert.equal((await provider.autocomplete('Éco',{limit:2})).length,2);assert.equal(urls[0]?.searchParams.get('autocomplete'),'1');assert.equal(urls[0]?.searchParams.get('q'),'éco');
});
test('requested result count clamped to configured maximum',async()=>{
 const {provider,urls}=setup(async()=>Response.json(collection(Array.from({length:15},()=>feature()))));
 assert.equal((await provider.search('adresse',{limit:100})).length,10);assert.equal(urls[0]?.searchParams.get('limit'),'10');
});
for(const limit of [0,-1,1.2,NaN])test(`invalid limit ${limit}`,async()=>await assert.rejects(setup().provider.search('adresse',{limit}),InvalidGeocodingQueryError));
test('native official filters are sent with exact parameter names',async()=>{
 const {provider,urls}=setup();await provider.search('adresse',{departmentCode:'2A',cityCode:'2A004',city:'  Ajaccio ',postcode:'20000',near:{latitude:41.9,longitude:8.7}});
 const p=urls[0]!.searchParams;assert.equal(p.get('depcode'),'2A');assert.equal(p.get('citycode'),'2A004');assert.equal(p.get('city'),'ajaccio');assert.equal(p.get('postcode'),'20000');assert.equal(p.get('lat'),'41.9');assert.equal(p.get('lon'),'8.7');
});
test('overseas department supported without mainland hardcoding',async()=>{
 const {provider,urls}=setup();await provider.search('Saint Denis',{departmentCode:'974'});assert.equal(urls[0]?.searchParams.get('depcode'),'974');
});
test('invalid filters rejected',async()=>{
 await assert.rejects(setup().provider.search('adresse',{departmentCode:'France'}),InvalidGeocodingQueryError);
 await assert.rejects(setup().provider.search('adresse',{cityCode:'oops'}),InvalidGeocodingQueryError);
});
test('bounds use a geographic bias and strict local result filtering',async()=>{
 const {provider,urls}=setup(async()=>Response.json(collection([feature('Lyon'),feature('Paris',2.35,48.85)])));
 const r=await provider.search('adresse',{bounds:{west:4,south:45,east:5,north:46}});
 assert.equal(r.length,1);assert.equal(r[0]?.label,'Lyon');assert.equal(urls[0]?.searchParams.get('limit'),'50');assert.equal(urls[0]?.searchParams.get('lon'),'4.5');
});
test('invalid bounding box is rejected',async()=>await assert.rejects(setup().provider.search('adresse',{bounds:{west:5,south:45,east:4,north:46}}),InvalidGeocodingQueryError));
test('reverse maps named latitude and longitude into correct API parameters',async()=>{
 const {provider,urls}=setup(async()=>Response.json(collection([feature('Paris',2.3522,48.8566)])));
 const r=await provider.reverse(48.8566,2.3522);assert.deepEqual(r?.coordinates,{latitude:48.8566,longitude:2.3522});
 assert.equal(urls[0]?.pathname,'/geocodage/reverse');assert.equal(urls[0]?.searchParams.get('lat'),'48.8566');assert.equal(urls[0]?.searchParams.get('lon'),'2.3522');
 assert.deepEqual(toGeoJsonPosition(r!.coordinates),[2.3522,48.8566]);
});
test('reverse no result is null',async()=>assert.equal(await setup(async()=>Response.json(collection([]))).provider.reverse(48,2),null));
for(const [lat,lon]of [[91,2],[-91,2],[48,181],[48,-181],[NaN,2],[48,Infinity]])test(`invalid coordinates ${lat}/${lon} never call HTTP`,async()=>{
 const {provider,urls}=setup();await assert.rejects(provider.reverse(lat!,lon!),InvalidCoordinatesError);assert.equal(urls.length,0);
});
test('coordinate global bounds inclusive',()=>assert.deepEqual(coordinates(-90,180),{latitude:-90,longitude:180}));
test('first request reaches HTTP, normalized second request uses cache',async()=>{
 const {provider,urls}=setup();await provider.search('12 Rue Victor Hugo');await provider.search('  12 rue victor hugo  ');assert.equal(urls.length,1);
});
test('NFC accents and typographic apostrophes share cache',async()=>{
 const {provider,urls}=setup();await provider.search("École de l'Hôtel");await provider.search('École de l’Hôtel');assert.equal(urls.length,1);
});
test('distinct filters cannot share cache',async()=>{
 const {provider,urls}=setup();await provider.search('adresse',{cityCode:'75056'});await provider.search('adresse',{cityCode:'69123'});assert.equal(urls.length,2);
});
test('search, autocomplete and reverse cache keys are distinct',async()=>{
 const {provider,urls}=setup();await provider.search('adresse');await provider.autocomplete('adresse');await provider.reverse(48,2);assert.equal(urls.length,3);
});
test('cache expiration requires a new HTTP request',async()=>{
 const {provider,urls,clock}=setup(undefined,{cacheTtlMs:1000});await provider.search('adresse');clock.time+=1001;await provider.search('adresse');assert.equal(urls.length,2);
});
test('empty results have a short TTL',async()=>{
 const {provider,urls,clock}=setup(async()=>Response.json(collection([])),{emptyCacheTtlMs:100});await provider.search('adresse');await provider.search('adresse');assert.equal(urls.length,1);clock.time+=101;await provider.search('adresse');assert.equal(urls.length,2);
});
test('network error is not cached',async()=>{
 let calls=0;const {provider}=setup(async()=>{if(++calls===1)throw new TypeError('private address in network error');return Response.json(collection());});
 await assert.rejects(provider.search('adresse'),e=>e instanceof GeocodingUnavailableError&&!e.message.includes('private address'));
 assert.equal((await provider.search('adresse')).length,1);assert.equal(calls,2);
});
test('cached values are isolated from consumer mutations',async()=>{
 const {provider}=setup();const r=await provider.search('adresse');r.pop();assert.equal((await provider.search('adresse')).length,1);
 const cached=await provider.search('adresse');cached.pop();assert.equal((await provider.search('adresse')).length,1);
});
test('bounded memory cache evicts least recently used entry and supports clear',async()=>{
 const c=new MemoryGeocodingCache(2);await c.set('a',[],1000);await c.set('b',[],1000);await c.get('a');await c.set('c',[],1000);assert.equal(await c.get('b'),undefined);await c.clear();assert.equal(await c.get('a'),undefined);
});
test('cache TTL zero disables storage',async()=>{
 const {provider,urls}=setup(undefined,{cacheTtlMs:0});await provider.search('adresse');await provider.search('adresse');assert.equal(urls.length,2);
});
test('idle cache entries expire automatically',async()=>{
 const c=new MemoryGeocodingCache(2,()=>0);await c.set('x',[],5);await wait(20);assert.equal(await c.get('x'),undefined);
});
test('timeout rejects even when HTTP implementation ignores AbortSignal',async()=>{
 const {provider}=setup(()=>new Promise(()=>{}),{timeoutMs:10});await assert.rejects(provider.search('adresse'),GeocodingTimeoutError);
});
test('timeout also covers a response body that never completes',async()=>{
 const {provider}=setup(async()=>new Response(new ReadableStream({start(){}})),{timeoutMs:10});await assert.rejects(provider.search('adresse'),GeocodingTimeoutError);
});
test('timeout retry is limited',async()=>{
 const {provider,urls}=setup(()=>new Promise(()=>{}),{timeoutMs:5,maxRetries:1});await assert.rejects(provider.search('adresse'),GeocodingTimeoutError);assert.equal(urls.length,2);
});
for(const code of [502,503,504])test(`HTTP ${code} is retried once`,async()=>{
 let calls=0;const {provider,clock}=setup(async()=>++calls===1?new Response('',{status:code}):Response.json(collection()),{maxRetries:1});
 assert.equal((await provider.search('adresse')).length,1);assert.equal(calls,2);assert.ok(clock.waits.includes(500));
});
test('temporary network failure is retried once',async()=>{
 let calls=0;const {provider}=setup(async()=>{if(++calls===1)throw new TypeError('network');return Response.json(collection());},{maxRetries:1});assert.equal((await provider.search('adresse')).length,1);assert.equal(calls,2);
});
for(const code of [400,404,500])test(`HTTP ${code} is not automatically retried`,async()=>{
 const {provider,urls}=setup(async()=>new Response('private body',{status:code}),{maxRetries:2});
 await assert.rejects(provider.search('adresse'),code===500?GeocodingUnavailableError:InvalidGeocodingQueryError);assert.equal(urls.length,1);
});
test('invalid JSON is a typed error and not retried',async()=>{
 const {provider,urls}=setup(async()=>new Response('{bad'),{maxRetries:2});await assert.rejects(provider.search('adresse'),GeocodingResponseError);assert.equal(urls.length,1);
});
test('429 respects Retry-After and blocks subsequent calls before HTTP',async()=>{
 let calls=0;const {provider,clock}=setup(async()=>++calls===1?new Response('',{status:429,headers:{'Retry-After':'2'}}):Response.json(collection()),{maxRetries:2});
 await assert.rejects(provider.search('adresse'),e=>e instanceof GeocodingRateLimitError&&e.retryAfterMs===2000);
 await assert.rejects(provider.search('autre adresse'),GeocodingRateLimitError);assert.equal(calls,1);
 clock.time+=2000;assert.equal((await provider.search('adresse')).length,1);assert.equal(calls,2);
});
test('Retry-After supports HTTP date and invalid fallback',()=>{
 const now=Date.parse('2026-09-05T12:00:00Z');assert.equal(retryAfterMs('Sat, 05 Sep 2026 12:00:03 GMT',now,1000),3000);assert.equal(retryAfterMs('nonsense',now,1000),1000);assert.equal(retryAfterMs(null,now,1000),1000);
});
test('rate gate spaces actual dispatches',async()=>{
 const clock=new FakeClock(),gate=new GeocodingRequestGate(5,clock);await gate.acquire(1000);await gate.acquire(1000);await gate.acquire(1000);assert.deepEqual(clock.waits,[200,200]);
});
test('rate gate does not queue indefinitely',async()=>{
 const gate=new GeocodingRequestGate(1,new FakeClock());await gate.acquire(0);await assert.rejects(gate.acquire(0),GeocodingRateLimitError);
});
test('default limiter is shared across providers on the same origin',()=>{
 assert.equal(sharedRequestGate('https://test-geocode.invalid/path',5),sharedRequestGate('https://test-geocode.invalid/other',10));
});
test('pre-aborted request does not call HTTP or return cache',async()=>{
 const {provider,urls}=setup();const c=new AbortController();c.abort();await assert.rejects(provider.search('adresse',{signal:c.signal}),GeocodingCancelledError);assert.equal(urls.length,0);
});
test('cancellation interrupts in-flight request without retry',async()=>{
 const {provider,urls}=setup(()=>new Promise(()=>{}),{timeoutMs:100,maxRetries:2});const c=new AbortController();const result=provider.search('adresse',{signal:c.signal});const checked=assert.rejects(result,GeocodingCancelledError);await wait(5);c.abort();await checked;assert.equal(urls.length,1);
});
test('debounce sends only last input and cancels previous promise',async()=>{
 const {provider,urls}=setup();const input=new DebouncedGeocodingAutocomplete(provider,5);
 const first=assert.rejects(input.suggest('12 rue vic'),GeocodingCancelledError);const second=input.suggest('12 rue victor');await first;assert.equal((await second).length,1);assert.equal(urls.length,1);
});
test('short input cancels pending autocomplete with no HTTP',async()=>{
 const {provider,urls}=setup();const input=new DebouncedGeocodingAutocomplete(provider,10);
 const first=assert.rejects(input.suggest('adresse'),GeocodingCancelledError);assert.deepEqual(await input.suggest('ad'),[]);await first;assert.equal(urls.length,0);
});
test('late response from obsolete input cannot replace new suggestions',async()=>{
 let finish:((r:Response)=>void)|undefined;
 const {provider}=setup(async(url)=>url.searchParams.get('q')==='old'?new Promise<Response>(resolve=>{finish=resolve;}):Response.json(collection([feature('New result')])));
 const input=new DebouncedGeocodingAutocomplete(provider,2);
 const old=assert.rejects(input.suggest('old'),GeocodingCancelledError);await wait(10);const latest=input.suggest('new');await old;assert.equal((await latest)[0]?.label,'New result');finish?.(Response.json(collection([feature('Old result')])));
});
test('consumer abort cancels debounce timer',async()=>{
 const {provider,urls}=setup();const input=new DebouncedGeocodingAutocomplete(provider,20);const c=new AbortController();const task=assert.rejects(input.suggest('adresse',{signal:c.signal}),GeocodingCancelledError);c.abort();await task;await wait(25);assert.equal(urls.length,0);
});
test('configuration has documented defaults and supports override',()=>{
 assert.equal(geocodingConfigFromEnv({}).ratePerSecond,5);assert.equal(geocodingConfigFromEnv({GEOCODING_CACHE_TTL_MS:'1000'}).cacheTtlMs,1000);
});
for(const env of [{GEOCODING_TIMEOUT_MS:'NaN'},{GEOCODING_RATE_LIMIT:'50'},{GEOCODING_MAX_RETRIES:'100'},{GEOCODING_BASE_URL:'http://example.com'},{GEOCODING_BASE_URL:'https://api-adresse.data.gouv.fr'}])test(`invalid config ${Object.keys(env)[0]} rejected`,()=>assert.throws(()=>geocodingConfigFromEnv(env),GeocodingConfigurationError));
test('real clock sleep is cancellable',async()=>{
 const c=new AbortController();const task=assert.rejects(systemClock.sleep(100,c.signal),GeocodingCancelledError);c.abort();await task;
});

test('malformed Retry-After does not become an immediate retry',()=>{
 const now=Date.now();for(const value of ['-1','Infinity','123garbage'])assert.equal(retryAfterMs(value,now,1000),1000);
});
test('429 without Retry-After applies the configured fallback',async()=>{
 const {provider}=setup(async()=>new Response('',{status:429}),{defaultRetryAfterMs:1500});
 await assert.rejects(provider.search('adresse'),e=>e instanceof GeocodingRateLimitError&&e.retryAfterMs===1500);
});
test('concurrent dispatches share rate budget',async()=>{
 let time=0;const ticks:number[]=[];
 const clock:Clock={now:()=>time,sleep:async(ms)=>{await wait(1);time+=ms;}};
 const gate=new GeocodingRequestGate(5,clock);
 await Promise.all([1,2,3].map(async()=>{await gate.acquire(1000);ticks.push(time);}));
 assert.ok(ticks[1]!>=ticks[0]!+200);assert.ok(ticks[2]!>=ticks[1]!+200);
});
