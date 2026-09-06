import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import type {ApiDependencies} from './api.js';
import {createApi} from './api.js';
export function webServer(dependencies:ApiDependencies,origin:string,root='dist/web') {
 const api=createApi(dependencies),staticRoot=resolve(root);
 return createServer({requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','geolocation=(self), camera=(), microphone=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  try {
   const url=new URL(req.url??'/',origin);
   if(url.pathname.startsWith('/api/')){
    const chunks:Buffer[]=[];let bytes=0;
    if(Number(req.headers['content-length']??0)>8192){res.writeHead(413,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end(JSON.stringify({error:{code:'PAYLOAD_TOO_LARGE',message:'Requête trop volumineuse.'}}));return;}
    for await(const chunk of req){bytes+=Buffer.byteLength(chunk as Buffer);if(bytes>8192){res.writeHead(413,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end(JSON.stringify({error:{code:'PAYLOAD_TOO_LARGE',message:'Requête trop volumineuse.'}}));return;}chunks.push(chunk as Buffer);}
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
    const request=new Request(new URL(url.pathname+url.search,origin),{method:req.method??'GET',headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
    let timer:ReturnType<typeof setTimeout>|undefined;
    const response=await Promise.race([api(request,req.socket.remoteAddress??'unknown'),new Promise<Response>(r=>{timer=setTimeout(()=>r(new Response(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'Vérification trop longue. Réessayez dans quelques instants.'}}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})),10000);})]).finally(()=>{if(timer)clearTimeout(timer);});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
   const page=['/','/sources','/confidentialite','/mentions-legales'].includes(url.pathname);
   const path=resolve(staticRoot,page?'index.html':'.'+decodeURIComponent(url.pathname));
   if(!path.startsWith(staticRoot+'/')){res.writeHead(404);res.end();return;}
   if(!(await stat(path)).isFile()){res.writeHead(404);res.end();return;}
   const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml'};
   res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':page?'no-store':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'public, max-age=86400'});
   res.end(req.method==='HEAD'?undefined:await readFile(path));
  }catch{res.writeHead(404,{'Cache-Control':'no-store'});res.end('Ressource indisponible.');}
 });
}
