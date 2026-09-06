import type { ParkingTariffSchedule, SourceRecord } from '../../../domain/src/local-parking.js';
export const LYON_ORDER_URL='https://www.lyon.fr/sites/lyonfr/files/content/documents/2026-03/2026RP48956.pdf';
export const LYON_SOURCE:SourceRecord={id:'lyon-uno',url:LYON_ORDER_URL,licence:'Texte administratif public ; licence spécifique non indiquée',version:'2026RP48956',retrievedAt:'2026-09-06T00:00:00Z'};
export const LYON_TARIFF:ParkingTariffSchedule={id:'lyon-uno-2026-09-06',effectiveFrom:'2026-03-01T00:00:00+01:00',source:{...LYON_SOURCE,id:'lyon-visitor-tariffs',url:'https://www.lyon.fr/tarification-progressive-du-stationnement',version:'verified-2026-09-06'},
 minutes:[30,60,90,120,180,240,300,360,420,480,540,600],rates:{
 REDUCED:[0.5,1,2,3,6,12,14,16,18,20,22,35],STANDARD:[1,2,4,6,10,14,18,22,26,30,34,55],INCREASED:[2,3.5,6.5,9.5,15.5,21.5,27.5,33.5,39.5,45.5,51.5,80]}};
/** Editorial revalidation required; retrieving a road feed never renews this legal evidence. */
export const LYON_REVIEW_UNTIL='2026-10-06T00:00:00Z';
export const FACILITY_STATIC_URL='https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:parkings-des-operateurs-de-stationnements-de-la-metropole-de-lyon&outputFormat=application/json&SRSNAME=EPSG:4326';
export const FACILITY_REALTIME_URL='https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:parkings-de-la-metropole-de-lyon-disponibilites-temps-reel-v2&outputFormat=application/json&SRSNAME=EPSG:4326';
export const ROADS_URL='https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:adr_voie_lieu.adraxevoie&outputFormat=application/json&SRSNAME=EPSG:4326';
