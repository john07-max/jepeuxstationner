/** WGS84 / EPSG:4326. Named fields avoid anonymous coordinate-order ambiguity. */
export interface Coordinates { readonly latitude:number; readonly longitude:number }
export interface GeographicBounds { readonly west:number; readonly south:number; readonly east:number; readonly north:number }
export interface GeocodingResult {
 readonly label:string; readonly coordinates:Coordinates; readonly provider:string;
 readonly id?:string; readonly postcode?:string; readonly city?:string; readonly cityCode?:string;
 readonly street?:string; readonly housenumber?:string; readonly score?:number;
 readonly precision?:'housenumber'|'street'|'locality'|'municipality';
 readonly distanceMeters?:number;
}
export type GeocodingSuggestion=GeocodingResult;
export type ReverseGeocodingResult=GeocodingResult;
export interface GeocodingSearchOptions {
 readonly limit?:number; readonly departmentCode?:string; readonly cityCode?:string;
 readonly city?:string; readonly postcode?:string; readonly bounds?:GeographicBounds;
 readonly near?:Coordinates; readonly signal?:AbortSignal;
}
export type AutocompleteOptions=GeocodingSearchOptions;
export interface GeocodingProvider {
 search(query:string,options?:GeocodingSearchOptions):Promise<GeocodingResult[]>;
 autocomplete(query:string,options?:AutocompleteOptions):Promise<GeocodingSuggestion[]>;
 reverse(latitude:number,longitude:number,options?:{readonly signal?:AbortSignal}):Promise<ReverseGeocodingResult|null>;
}
export interface GeocodingCache {
 get(key:string):Promise<GeocodingResult[]|undefined>;
 set(key:string,value:GeocodingResult[],ttlMs:number):Promise<void>;
 clear():Promise<void>;
}
export class GeocodingError extends Error {
 constructor(readonly code:string,message:string){super(message);this.name=new.target.name;}
}
export class InvalidCoordinatesError extends GeocodingError {
 constructor(){super('INVALID_COORDINATES','Coordonnées invalides : latitude [-90,90], longitude [-180,180].');}
}
export class InvalidGeocodingQueryError extends GeocodingError {
 constructor(){super('INVALID_QUERY','Requête ou filtres de géocodage invalides.');}
}
export class GeocodingUnavailableError extends GeocodingError {
 constructor(){super('UNAVAILABLE','Service de géocodage temporairement indisponible.');}
}
export class GeocodingTimeoutError extends GeocodingError {
 constructor(){super('TIMEOUT','Délai du service de géocodage dépassé.');}
}
export class GeocodingResponseError extends GeocodingError {
 constructor(){super('INVALID_RESPONSE','Réponse du fournisseur de géocodage invalide.');}
}
export class GeocodingRateLimitError extends GeocodingError {
 constructor(readonly retryAfterMs:number){super('RATE_LIMITED','Géocodage temporairement limité ; respecter le délai indiqué.');}
}
export class GeocodingCancelledError extends GeocodingError {
 constructor(){super('CANCELLED','Requête de géocodage annulée.');}
}
export class GeocodingConfigurationError extends GeocodingError {
 constructor(){super('INVALID_CONFIGURATION','Configuration du géocodage invalide.');}
}
export function coordinates(latitude:number,longitude:number):Coordinates {
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw new InvalidCoordinatesError();
 return {latitude,longitude};
}
export function toGeoJsonPosition(c:Coordinates):readonly [longitude:number,latitude:number] {
 coordinates(c.latitude,c.longitude);return [c.longitude,c.latitude];
}
export function normalizeGeocodingQuery(query:string):string {
 if(typeof query!=='string'||query.length>200||/[\u0000-\u0008\u000e-\u001f\u007f]/u.test(query)) throw new InvalidGeocodingQueryError();
 return query.normalize('NFC').replace(/’/gu,"'").trim().replace(/\s+/gu,' ').toLocaleLowerCase('fr-FR');
}
