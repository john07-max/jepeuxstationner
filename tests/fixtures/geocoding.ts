// Synthetic HTTP fixtures, never a captured private user search.
export function feature(label='12 Rue Victor Hugo 69002 Lyon',longitude=4.83,latitude=45.75){
 return {type:'Feature',geometry:{type:'Point',coordinates:[longitude,latitude]},properties:{
  id:'fixture-address',label,postcode:'69002',city:'Lyon',citycode:'69382',street:'Rue Victor Hugo',housenumber:'12',score:0.92,type:'housenumber',internal_debug:'must not leak',
 }};
}
export const collection=(features:unknown[]=[feature()])=>({type:'FeatureCollection',features});
