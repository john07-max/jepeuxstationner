import { GeoPlatformGeocodingProvider } from '../../../packages/adapters/src/geocoding/provider.js';
import { geocodingConfigFromEnv } from '../../../packages/adapters/src/geocoding/config.js';
import { GeocodingError } from '../../../packages/domain/src/geocoding.js';
// Explicit CLI output requested by its operator; never a server search log.
try {
 const provider=new GeoPlatformGeocodingProvider(geocodingConfigFromEnv(process.env));
 const args=process.argv.slice(2);
 const results=args[0]==='--reverse'?[await provider.reverse(Number(args[1]),Number(args[2]))]:
  args[0]==='--autocomplete'?await provider.autocomplete(args.slice(1).join(' ')):
  await provider.search(args.join(' '));
 for(const r of results){if(r)console.log(JSON.stringify({adresse:r.label,latitude:r.coordinates.latitude,longitude:r.coordinates.longitude,codePostal:r.postcode,commune:r.city,codeINSEE:r.cityCode,scoreFournisseur:r.score},null,2));}
 if(!results.some(Boolean))console.log('Aucun résultat.');
} catch(error){console.error(error instanceof GeocodingError?`${error.code}: ${error.message}`:'Géocodage indisponible.');process.exitCode=1;}
