import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Coordinates} from '../../../packages/domain/src/geocoding.js';
import type {NearbyParkingFacility} from '../../../packages/domain/src/local-parking.js';
export default function ParkingMap({position,facilities}:{position:Coordinates;facilities:readonly NearbyParkingFacility[]}){
 const container=useRef<HTMLDivElement>(null),[error,setError]=useState(false);
 useEffect(()=>{if(!container.current)return;let map:maplibregl.Map|undefined;try{
  map=new maplibregl.Map({container:container.current,center:[position.longitude,position.latitude],zoom:14,attributionControl:false,style:{version:8,sources:{roads:{type:'geojson',data:'/lyon-map.geojson'}},layers:[{id:'background',type:'background',paint:{'background-color':'#eaf0f3'}},{id:'roads',type:'line',source:'roads',paint:{'line-color':'#fff','line-width':3}}]}});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Axes : Métropole de Lyon · Licence Ouverte 2.0'}));
  const points=[{coordinates:position,name:'Position recherchée',parking:false},...facilities.slice(0,3).map(f=>({coordinates:f.coordinates,name:f.name,parking:true}))];
  const bounds=new maplibregl.LngLatBounds();for(const p of points){const el=document.createElement('div');el.className='map-pin'+(p.parking?' parking':'');el.textContent=p.parking?'P':'Vous';el.title=p.name;new maplibregl.Marker({element:el}).setLngLat([p.coordinates.longitude,p.coordinates.latitude]).addTo(map);bounds.extend([p.coordinates.longitude,p.coordinates.latitude]);}
  if(points.length>1)map.fitBounds(bounds,{padding:55,maxZoom:15,duration:0});map.on('error',()=>setError(true));
 }catch{setError(true);}return()=>map?.remove();},[position,facilities]);
 return <><div className="map-wrap" role="region" aria-label="Carte de la position et des parkings"><div className="map-canvas" ref={container}/></div><p className="map-caption">{error?'La carte est indisponible. Le résultat textuel reste utilisable.':'Axes de voirie : ils ne représentent pas des places de stationnement certifiées.'}</p></>;
}
