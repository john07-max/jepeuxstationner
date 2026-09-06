import type { ParkingDecision, ParkingQuery, SourceEvidence } from './index.js';
import type { Coordinates, GeocodingResult } from './geocoding.js';
export interface SourceRecord { id:string; url:string; licence:string; version:string; retrievedAt:string; updatedAt?:string; publishedAt?:string }
export interface ParkingCoverage {
 cityId:string; zoneId:string; status:'DOCUMENTED'|'UNKNOWN';
 /** Exact verified marked parking-space polygon; a road axis is insufficient. */
 markedSpaceVerified:boolean; ambiguous:boolean; regime:'UNO'|'UNSUPPORTED'; source:SourceEvidence;
}
export interface VehicleProfile { vehicleType:'CAR'|'OTHER'; energy?:'THERMAL'|'PLUGIN_HYBRID'|'ELECTRIC'; weightKg?:number }
export interface ParkingPricing { status:'FREE'|'PAID'|'UNKNOWN'; amount?:number; currency?:'EUR'; rateClass?:string; validUntil?:string; explanation:string; source?:SourceRecord }
export interface ParkingTariffSchedule {
 id:string; effectiveFrom:string; source:SourceRecord;
 minutes:readonly number[]; rates:Readonly<Record<'REDUCED'|'STANDARD'|'INCREASED',readonly number[]>>;
}
export interface ParkingFacility {
 id:string; source:SourceRecord; externalId:string; name:string; coordinates:Coordinates;
 address?:string; capacity?:number; availableSpaces?:number; occupiedSpaces?:number;
 openingHours?:string; pricing?:ParkingPricing; hourlyTariffs?:Readonly<Record<string,number>>;
 publicAccess:boolean; realtimeSourceUrl?:string; realtime:'AVAILABLE'|'UNKNOWN'; lastUpdatedAt?:string; sourceUrl:string;
}
export interface NearbyParkingFacility extends ParkingFacility { distanceMeters:number }
export interface CityCoverageReport { officialStreets:number; matched:number; ambiguous:number; unmatched:number; coveragePercent:number; verifiedParkingSpaces:number }
export interface ParkingCheckResult {
 /** Operational failure, distinct from insufficient business coverage. */
 failure?:'SERVICE_UNAVAILABLE';
 location:GeocodingResult|null; decision:ParkingDecision; allowedUntil?:string; mustLeaveBefore?:string; conditions:readonly string[];
 pricing:ParkingPricing; confidence:'DOCUMENTED'|'UNKNOWN'; sources:readonly SourceEvidence[];
 nearbyParkings:readonly NearbyParkingFacility[]; dataFreshness:'CURRENT'|'UNKNOWN'; warnings:readonly string[];
}
export interface ParkingContext { query:ParkingQuery; coverage:ParkingCoverage }
