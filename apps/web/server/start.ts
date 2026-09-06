import pg from 'pg';
import {GeoPlatformGeocodingProvider} from '../../../packages/adapters/src/geocoding/provider.js';
import {geocodingConfigFromEnv} from '../../../packages/adapters/src/geocoding/config.js';
import {createLyonCheckParkingService} from '../../../packages/application/src/lyon.js';
import {webServer} from './server.js';
const port=Number(process.env['PORT']??3000),origin=process.env['APP_ORIGIN']??`http://localhost:${port}`;
if(!Number.isInteger(port)||port<1||port>65535||!/^https?:\/\//.test(origin))throw new Error('Invalid server configuration');
if(!process.env['DATABASE_URL'])throw new Error('DATABASE_URL required; use npm run demo:web only for fictional data');
const pool=new pg.Pool({connectionString:process.env['DATABASE_URL'],max:8,connectionTimeoutMillis:2000,statement_timeout:2000});
pool.on('error',()=>console.error(JSON.stringify({event:'database.error'})));
const geocoder=new GeoPlatformGeocodingProvider(geocodingConfigFromEnv(process.env));
const server=webServer({geocoder,
 async check(input,now){const client=await pool.connect();try{return await createLyonCheckParkingService(client,geocoder).checkPosition(input,input,now,input.vehicle);}finally{client.release();}},
 async inCity(p){const r=await pool.query("SELECT ST_Covers(boundary,ST_SetSRID(ST_MakePoint($1,$2),4326)) inside FROM cities WHERE id='lyon'",[p.longitude,p.latitude]);if(r.rowCount!==1)throw new Error('City boundary unavailable');return r.rows[0]?.inside===true;},
 async ready(){try{await pool.query('SELECT 1');return true;}catch{return false;}},
 log:(event,status,durationMs)=>console.log(JSON.stringify({event,status,durationMs,city:'Lyon'}))},origin);
server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'server.ready',port})));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>{void pool.end();});});
