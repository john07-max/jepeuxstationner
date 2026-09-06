import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
// Load the documented local configuration before spawning either process.
if (existsSync('.env')) process.loadEnvFile('.env');
// One same-origin frontend; API stays server-only. Demo is explicitly opt-in.
const children=[];
const compile=spawn(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json'],{stdio:'inherit'});
compile.once('exit',code=>{if(code){process.exitCode=code;return;}
 const demo=process.argv.includes('--demo')||process.env.JPS_PREVIEW_DEMO==='1';
 children.push(spawn(process.execPath,['--use-env-proxy',demo?'dist/tests/support/web-demo.js':'dist/apps/web/server/start.js'],{stdio:'inherit',env:{...process.env,PORT:'4174',APP_ORIGIN:process.env.APP_ORIGIN??'http://localhost:4173'}}));
 children.push(spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts',...process.argv.slice(2).filter(x=>x!=='--demo')],{stdio:'inherit'}));
 for(const child of children)child.once('exit',()=>{for(const other of children)if(other!==child)other.kill();});
});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{compile.kill();for(const child of children)child.kill();});
