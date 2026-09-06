import pg from 'pg';
import {GeoPlatformGeocodingProvider} from '../../../packages/adapters/src/geocoding/provider.js';
import {geocodingConfigFromEnv} from '../../../packages/adapters/src/geocoding/config.js';
import {createLyonCheckParkingService} from '../../../packages/application/src/lyon.js';
try {
 const [address,start,end]=process.argv.slice(2);
 if(!address||!start||!end)throw new Error('Usage: npm run check:parking -- "adresse à Lyon" "début ISO avec fuseau" "fin ISO avec fuseau"');
 if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL required');
 const client=new pg.Client({connectionString:process.env['DATABASE_URL'],connectionTimeoutMillis:5000,statement_timeout:2000});
 const geocoder=new GeoPlatformGeocodingProvider(geocodingConfigFromEnv(process.env));
 try{await client.connect();const result=await createLyonCheckParkingService(client,geocoder).check(address,{start,end},new Date().toISOString());console.log(JSON.stringify(result,null,2));}finally{await client.end();}
}catch{console.error('Vérification indisponible. Vérifier les arguments et la connexion PostgreSQL.');process.exitCode=1;}
