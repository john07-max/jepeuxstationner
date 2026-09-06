import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
async function address(page:Page,name:string){await page.getByRole('combobox').fill(name);await page.getByRole('option').getByRole('button').click();}
async function check(page:Page,name:string){await address(page,name);await page.getByLabel('4 h',{exact:true}).check();await page.getByRole('button',{name:'Vérifier le stationnement'}).click();}
test.beforeEach(async({page})=>{await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')throw new Error('External request forbidden in deterministic E2E');await route.continue();});await page.goto('/');});
test('principal: address -> four hours -> forbidden -> three parkings',async({page})=>{await check(page,'Interdit');await expect(page.getByRole('heading',{name:'NON',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:/Itinéraire/})).toHaveCount(3);await expect(page.getByText('Stationnement payant',{exact:true})).toBeVisible();await expect(page.getByText('Disponibilité inconnue',{exact:false})).toHaveCount(3);});
test('conditional: future deadline is visible and preserved',async({page})=>{await check(page,'Conditionnel');await expect(page.getByRole('heading',{name:'OUI, MAIS…'})).toBeVisible();await expect(page.locator('.deadline strong')).toHaveText(/\d{2}:\d{2}/);await expect(page.getByText('Déplacez votre véhicule avant',{exact:false})).toBeVisible();});
test('allowed remains separate from payment',async({page})=>{await check(page,'Autorisé');await expect(page.getByRole('heading',{name:'OUI',exact:true})).toBeVisible();await expect(page.getByText('Stationnement payant',{exact:true})).toBeVisible();});
test('unknown is a safe explicit result, with alternatives',async({page})=>{await check(page,'Inconnu');await expect(page.getByRole('heading',{name:'INFORMATION INSUFFISANTE'})).toBeVisible();await expect(page.getByText('Vérifiez la signalisation sur place.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'OUI',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:/Itinéraire/})).toHaveCount(3);});
test('service failure is an error, not business UNKNOWN',async({page})=>{await check(page,'Erreur');await expect(page.getByRole('alert')).toContainText('Service temporairement indisponible');await expect(page.getByRole('heading',{name:'INFORMATION INSUFFISANTE'})).toHaveCount(0);});
test('outside Lyon explains pilot scope',async({page})=>{await check(page,'Paris');await expect(page.getByRole('alert')).toContainText('version bêta à Lyon');});
test('autocomplete minimum, keyboard and selected coordinates, two hours',async({page})=>{
 // Dedicated ordered fixture, independent of the generic demo search and public APIs.
 const suggestions=[
  {id:'keyboard-target',label:'Autorisé · cible clavier fictive, Lyon',provider:'fixture',precision:'housenumber',coordinates:{latitude:45.760123,longitude:4.832137}},
  {id:'keyboard-other',label:'Autorisé · autre adresse fictive, Lyon',provider:'fixture',precision:'housenumber',coordinates:{latitude:45.761234,longitude:4.833248}},
 ];
 await page.route('**/api/geocoding/autocomplete?*',async route=>{
  expect(new URL(route.request().url()).searchParams.get('q')).toBe('Autorisé');
  await route.fulfill({json:{suggestions}});
 });
 let requests=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/geocoding/autocomplete')requests++;});
 const field=page.getByRole('combobox');await field.fill('au');
 await page.waitForTimeout(400);expect(requests).toBe(0);
 await field.fill('Autorisé');
 // Scope to address suggestions: native vehicle <option>s are unrelated.
 const options=page.getByRole('listbox',{name:'Adresses proposées'}).getByRole('option');
 await expect.poll(()=>options.count()).toBeGreaterThanOrEqual(1);
 expect(await options.count()).toBeLessThanOrEqual(5);
 await expect(options).toHaveText(suggestions.map(s=>s.label));
 await field.press('ArrowDown');
 const selected=options.filter({hasText:suggestions[0]!.label});
 await expect(selected).toHaveAttribute('aria-selected','true');
 await field.press('Enter');
 await expect(page.getByText('Adresse sélectionnée.',{exact:true})).toBeVisible();
 await expect(field).toHaveValue(suggestions[0]!.label);
 await page.getByLabel('2 h',{exact:true}).check();
 const sent=page.waitForRequest('**/api/parking/check');
 await page.getByRole('button',{name:'Vérifier le stationnement'}).click();
 const body=(await sent).postDataJSON();
 expect({latitude:body.latitude,longitude:body.longitude}).toEqual(suggestions[0]!.coordinates);
 expect(Date.parse(body.end)-Date.parse(body.start)).toBe(7200000);
});
test('typing after selection invalidates result and selected address',async({page})=>{await check(page,'Autorisé');await expect(page.getByRole('heading',{name:'OUI',exact:true})).toBeVisible();await page.getByRole('combobox').fill('Autre');await expect(page.getByRole('button',{name:'Vérifier le stationnement'})).toBeDisabled();await expect(page.getByRole('heading',{name:'OUI',exact:true})).toHaveCount(0);});
test('geolocation requested only after click; rejected permission stays usable',async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(_ok:unknown,fail:(e:{code:number})=>void){fail({code:1});}}});});await page.reload();await expect(page.getByText(/n'a pas été autorisée/)).toHaveCount(0);await page.getByRole('button',{name:'Utiliser ma position'}).click();await expect(page.getByText(/n'a pas été autorisée/)).toBeVisible();await expect(page.getByRole('combobox')).toBeEditable();});
test('geolocation reverse keeps exact GPS position',async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(ok:(p:unknown)=>void){ok({coords:{latitude:45.760012,longitude:4.830012,accuracy:5}});}}});});await page.reload();await page.getByRole('button',{name:'Utiliser ma position'}).click();await expect(page.getByText('Adresse sélectionnée.',{exact:true})).toBeVisible();const sent=page.waitForRequest('**/api/parking/check');await page.getByRole('button',{name:'Vérifier le stationnement'}).click();const body=(await sent).postDataJSON();expect(body.longitude).toBe(4.830012);expect(body.latitude).toBe(45.760012);});
test('map is lazy and renders locally after text result',async({page})=>{
 const canvas=page.locator('.maplibregl-canvas');
 const map=page.getByRole('region',{name:'Carte de la position et des parkings',exact:true});
 await expect(map).toHaveCount(0);await expect(canvas).toHaveCount(0);
 await check(page,'Interdit');
 const decision=page.getByRole('heading',{name:'NON',exact:true});
 await expect(decision).toBeVisible();
 await expect(map).toHaveCount(0);await expect(canvas).toHaveCount(0);
 await expect(page.locator('.map-pin')).toHaveCount(0);
 await page.getByRole('button',{name:'Afficher la carte'}).click();
 await expect(map).toBeVisible();await expect(canvas).toBeVisible();
 await expect(map.locator('.map-pin')).toHaveCount(4);
 await expect(decision).toBeVisible();
});
for(const width of [320,375,390,430,768,1280])test(`responsive ${width}px: no horizontal overflow and comfortable controls`,async({page})=>{await page.setViewportSize({width,height:900});await expect(page.getByRole('heading',{name:'Puis-je stationner ici ?'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const box=await page.getByRole('button',{name:'Vérifier le stationnement'}).boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);await check(page,'Interdit');await expect(page.getByRole('heading',{name:'NON',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:`artifacts/phase4-${width}.png`,fullPage:true});});
for(const path of ['/sources','/confidentialite','/mentions-legales'])test(`information page ${path}`,async({page})=>{await page.goto(path);await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('link',{name:'← Revenir à la vérification'})).toBeVisible();});

test('map chunk failure preserves the authorization text',async({page})=>{
 await check(page,'Interdit');await expect(page.getByRole('heading',{name:'NON',exact:true})).toBeVisible();
 await page.route('**/assets/ParkingMap-*.js',route=>route.abort());
 await page.getByRole('button',{name:'Afficher la carte'}).click();
 await expect(page.getByText('Carte indisponible.',{exact:false})).toBeVisible();
 await expect(page.getByRole('heading',{name:'NON',exact:true})).toBeVisible();
});
