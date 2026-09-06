import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// CLI module is intentionally plain Node.js; import from repository root after tsc.
const {boundaryGeometry}=await import(pathToFileURL(process.cwd()+'/scripts/lyon-boundary.mjs').href);
const feature={type:'Feature',properties:{code:'69123',nom:'Lyon'},geometry:{type:'Polygon',coordinates:[[[4.8,45.7],[4.9,45.7],[4.9,45.8],[4.8,45.7]]]}};
test('Lyon bootstrap accepts an explicit official commune contour',()=>assert.deepEqual(boundaryGeometry(feature),feature.geometry));
test('Lyon bootstrap rejects wrong commune and default centre geometry',()=>{assert.throws(()=>boundaryGeometry({...feature,properties:{code:'75056',nom:'Paris'}}));assert.throws(()=>boundaryGeometry({...feature,geometry:{type:'Point',coordinates:[4.8,45.7]}}));});
test('Lyon bootstrap rejects absent or empty data',()=>{assert.throws(()=>boundaryGeometry(null));assert.throws(()=>boundaryGeometry({...feature,geometry:{type:'MultiPolygon',coordinates:[]}}));});
