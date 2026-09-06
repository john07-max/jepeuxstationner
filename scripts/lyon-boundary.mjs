import pg from 'pg';
import {pathToFileURL} from 'node:url';
export const BOUNDARY_URL='https://geo.api.gouv.fr/communes/69123?format=geojson&geometry=contour';
export function boundaryGeometry(feature) {
 if(feature?.type!=='Feature'||feature.properties?.code!=='69123'||feature.properties?.nom!=='Lyon'||!['Polygon','MultiPolygon'].includes(feature.geometry?.type)||!Array.isArray(feature.geometry.coordinates)||!feature.geometry.coordinates.length)throw new Error('Invalid official Lyon boundary');
 return feature.geometry;
}
export async function saveBoundary(client,feature) {
 const geometry=boundaryGeometry(feature);
 // Existing PostGIS constraints reject invalid/empty geometry. Never create parking bays.
 await client.query(`INSERT INTO cities(id,name,timezone,boundary)
 VALUES('lyon','Lyon','Europe/Paris',ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)))
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,timezone=EXCLUDED.timezone,boundary=EXCLUDED.boundary`,[JSON.stringify(geometry)]);
}
async function main() {
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
 const response=await fetch(BOUNDARY_URL,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Official boundary unavailable');
 const feature=await response.json();boundaryGeometry(feature);
 const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:30000});
 try{await client.connect();await saveBoundary(client,feature);console.log(JSON.stringify({event:'lyon.boundary.synced',source:BOUNDARY_URL,retrievedAt:new Date().toISOString()}));}finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Lyon boundary sync failed; inspect configuration/provider availability. No fabricated boundary used.');process.exitCode=1;});
