import type { ParkingRule } from './index.js';
export type Position = [number, number];
export type RuleGeometry = {type:'Point';coordinates:Position} | {type:'LineString';coordinates:Position[]} |
 {type:'Polygon';coordinates:Position[][]} | {type:'MultiPolygon';coordinates:Position[][][]};
/** Storage representation; bounded ParkingRule is projected for a specific stay. */
export interface ImportedParkingRule extends Omit<ParkingRule,'end'|'cityId'|'zoneId'> {
 end: string | null;
 externalId: string;
 geometry: RuleGeometry;
 permanent: boolean;
 active: boolean;
 supported: boolean;
 limitations: string[];
 recurrence: string[];
 vehicleConditions: string[];
 orderReference: string;
 description: string;
}
