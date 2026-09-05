# Géocodage français — PHASE 1

Cette couche transforme texte/adresse en coordonnées, coordonnées en localisant, et texte partiel en suggestions. Elle ne détermine aucune autorisation de stationnement. Le moteur, les migrations et la lecture PostGIS de PHASE 0.5 restent inchangés.

## Fournisseur et contrat vérifié

Fournisseur : Géoplateforme, index `address`, données BAN françaises, sans clé API. Contrat OpenAPI consulté pendant cette implémentation ; source : [documentation officielle](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/) et [OpenAPI YAML](https://data.geopf.fr/geocodage/openapi.yaml).

| Opération interne | Appel officiel |
| --- | --- |
| search | GET https://data.geopf.fr/geocodage/search, q, index=address, autocomplete=0, limit |
| autocomplete | Même endpoint search, autocomplete=1 |
| reverse | GET https://data.geopf.fr/geocodage/reverse, lat, lon, index=address, limit=1 |

L'autocomplétion intégrée est documentée : pas besoin d'un second protocole `/completion`. Aucun appel vers l'ancienne API Adresse. Les filtres natifs utilisés sont depcode (département), citycode (INSEE), city (nom de commune), postcode (code postal), lat/lon (préférence de proximité). Il ne faut pas utiliser le paramètre departmentcode réservé aux parcelles pour les adresses.

La France est le périmètre du jeu de données BAN ; aucune ville unique n'est codée en dur. Les codes départementaux ultramarins et corses sont acceptés. Le géocodage national ne signifie pas que le futur moteur de stationnement couvre plusieurs villes : ce dernier reste limité au périmètre validé.

## Architecture

- `packages/domain/src/geocoding.ts` : contrat GeocodingProvider, types normalisés, coordonnées, cache et erreurs.
- `packages/adapters/src/geocoding/provider.ts` : construction des paramètres, normalisation stricte de la réponse, application des filtres et du cache.
- `transport.ts` : unique appel fetch de production, timeout, retries et débit partagé.
- `cache.ts` : cache mémoire borné avec expiration effective des entrées.
- `config.ts` : configuration validée depuis un objet ou l'environnement.
- `autocomplete.ts` : debounce et annulation pour le futur consommateur.

Le domaine ne dépend pas de la Géoplateforme. Le provider/cache actuel s'exécute côté serveur Node ; le contrôleur de debounce est indépendant du fournisseur et peut être utilisé par le futur consommateur. Ne pas instancier le cache Node dans le navigateur. Aucune route HTTP applicative ou interface web n'est créée ici.

## Normalisation et précision

La requête est limitée à 200 caractères, normalisée NFC, espaces regroupés, casse française ignorée et apostrophe typographique ramenée à l'apostrophe simple. Accents et tirets sont conservés. Les critères de recherche, mode, limite, base URL et emprise participent à la clé de cache.

Une réponse doit être une FeatureCollection contenant des Feature Point 2D, avec label non vide et coordonnées numériques finies. Les champs optionnels sont validés. Une réponse partiellement malformée est rejetée entièrement, plutôt que fournir silencieusement une liste amputée. Aucun JSON brut, propriété interne ou score inventé n'est exposé.

La précision housenumber/street/locality/municipality est conservée lorsqu'elle existe. Le score est celui du fournisseur, pas une probabilité de stationnement autorisé. Un résultat de commune ou de rue n'identifie pas un emplacement ni un côté de chaussée.

## Coordonnées

| Contexte | Convention |
| --- | --- |
| Interne | `{ latitude, longitude }` |
| reverse(...) | Arguments latitude puis longitude |
| Paramètres HTTP | Noms explicites lat et lon |
| GeoJSON Point | `[longitude, latitude]` |
| PostGIS ST_MakePoint | `(longitude, latitude)`, SRID 4326 |

`coordinates()` impose latitude [-90,90] et longitude [-180,180]. `toGeoJsonPosition()` convertit explicitement vers l'ordre géospatial. Deux nombres inversés qui restent tous deux valides mondialement ne sont pas détectables avec certitude sans contexte ; aucune permutation automatique n'est faite. Les tests utilisent des points français asymétriques et les tests live des emprises de villes connues.

Le filtre `bounds` est une emprise sans traversée de l'antiméridien. Il privilégie son centre via lat/lon, demande au plus 50 candidats puis filtre strictement leurs coordonnées localement. Ce n'est PAS une recherche exhaustive de toutes les adresses de l'emprise. Utiliser cityCode/departmentCode/city/postcode pour restreindre le serveur quand possible.

## Cache et confidentialité

GeocodingCache est asynchrone pour permettre un futur backend ; aucun Redis requis. L'implémentation initiale reste seulement en RAM, maximum 500 entrées, éviction LRU. Résultats copiés pour éviter les mutations par un consommateur. Des timers non bloquants suppriment aussi les entrées inactives à échéance.

TTL par défaut : 24 h pour les résultats, 30 s pour une liste vide ou un reverse sans résultat. TTL zéro désactive le stockage correspondant. Aucune erreur réseau, HTTP, timeout ou réponse malformée n'est mise en cache. Cette durée est un compromis de performance configurable, pas une garantie de fraîcheur réglementaire.

Les clés peuvent contenir le texte normalisé et les valeurs contiennent des localisants : ils restent éphémères, sans disque, PostgreSQL, utilisateur, IP ou historique. Instancier le provider une fois par service pour réutiliser le cache. Deux appels simultanés non encore cachés peuvent être distincts, mais passent tous par la limitation du débit. Un futur cache partagé devra avoir une politique de rétention et de protection explicite.

## Débit, retries, 429 et timeout

Le service annonce 50 requêtes/s/IP. Le réglage choisi ici est plus bas : 5 requêtes/s, dispatchs espacés, limite partagée par origine HTTP entre les providers d'un même processus. La configuration est plafonnée à 20/s. La limite n'est pas distribuée : plusieurs processus ou réplicas partageant une IP devront partager un budget avant montée en charge.

Attente de débit au plus 1 s, sinon GeocodingRateLimitError. Timeout de 5 s par tentative couvrant fetch ET lecture du corps, avec AbortSignal et rejet borné même si une implémentation HTTP défectueuse ignore l'annulation. La lecture accepte un JSON de taille limitée après réception ; ce n'est pas un proxy HTTP de protection générique.

Une seule nouvelle tentative par défaut sur panne réseau, timeout, 502/503/504, après 500 ms. Maximum configurable : deux retries, backoff exponentiel. Pas de retry automatique pour 400, 404, 500, JSON invalide, coordonnées/requête invalides ou annulation. Un 404 HTTP est une erreur fournisseur/requête, jamais transformé arbitrairement en « aucun résultat » ; le cas normal sans résultat est un HTTP réussi avec features vide.

Pour 429 : lire Retry-After (secondes ou date HTTP), sinon délai de repli de 1 s. Placer l'origine en cooldown partagé et lever GeocodingRateLimitError avec retryAfterMs. Aucune nouvelle tentative automatique du même appel sur 429. Un appel suivant avant échéance échoue sans joindre le service ; un résultat déjà en cache peut être utilisé. Aucun délai Retry-After long n'est réduit pour accélérer le retry.

La construction par injection du client HTTP permet un futur circuit breaker ; aucun circuit breaker ou service supplémentaire imposé aujourd'hui.

## Autocomplétion du futur consommateur

Le provider refuse toute requête d'autocomplétion avant 3 caractères (retour []). Utiliser en plus `DebouncedGeocodingAutocomplete` avec 300 ms entre dernière saisie et appel. Chaque nouvelle saisie annule la précédente et rejette sa promesse avec CANCELLED. Les réponses tardives sont ignorées ; ne pas afficher cette annulation comme une erreur utilisateur.

```ts
const provider = new GeoPlatformGeocodingProvider(config);
const input = new DebouncedGeocodingAutocomplete(
  provider, config.debounceMs, config.minAutocompleteChars
);
try {
  const suggestions = await input.suggest(text, { cityCode: '69123' });
  // Afficher les suggestions ; laisser l'utilisateur sélectionner un résultat.
} catch (error) {
  if (!(error instanceof GeocodingCancelledError)) throw error;
}
// Au démontage du consommateur : input.cancel().
```

La sélection produit des coordonnées. Leur résolution vers une zone et un côté de chaussée suffisamment fiables reste une étape distincte, avant toute requête au moteur de stationnement. Aucun branchement automatique qui transformerait un localisant approximatif en autorisation n'est ajouté.

## Erreurs publiques

| Classe | Code / traitement |
| --- | --- |
| InvalidCoordinatesError | INVALID_COORDINATES, corriger les coordonnées |
| InvalidGeocodingQueryError | INVALID_QUERY, corriger requête/filtres |
| GeocodingUnavailableError | UNAVAILABLE, service indisponible |
| GeocodingTimeoutError | TIMEOUT, délai dépassé |
| GeocodingRateLimitError | RATE_LIMITED, respecter retryAfterMs |
| GeocodingResponseError | INVALID_RESPONSE, réponse non conforme |
| GeocodingCancelledError | CANCELLED, ignorer dans l'interface |
| GeocodingConfigurationError | INVALID_CONFIGURATION, corriger la configuration |

Les messages d'erreur ne recopient ni URL complète, ni corps HTTP, ni erreur réseau brute susceptible de contenir l'adresse. Aucun logging automatique des recherches. Pour une observabilité future : événements techniques agrégés uniquement. La CLI affiche le résultat demandé explicitement par l'opérateur ; ce n'est pas une journalisation de serveur.

## Configuration

Toutes les valeurs sont dans .env.example. Aucun secret nécessaire.

| Variable | Défaut |
| --- | --- |
| GEOCODING_BASE_URL | https://data.geopf.fr/geocodage/ |
| GEOCODING_TIMEOUT_MS | 5000 |
| GEOCODING_CACHE_TTL_MS | 86400000 |
| GEOCODING_EMPTY_CACHE_TTL_MS | 30000 |
| GEOCODING_CACHE_MAX_ENTRIES | 500 |
| GEOCODING_RATE_LIMIT | 5 |
| GEOCODING_MAX_QUEUE_WAIT_MS | 1000 |
| GEOCODING_MAX_RETRIES | 1 |
| GEOCODING_RETRY_BASE_MS | 500 |
| GEOCODING_DEFAULT_RETRY_AFTER_MS | 1000 |
| GEOCODING_MIN_AUTOCOMPLETE_CHARS | 3 |
| GEOCODING_DEBOUNCE_MS | 300 |
| GEOCODING_MAX_RESULTS | 10 |
| GEOCODING_DEFAULT_RESULTS | 5 |

Les URLs doivent être HTTPS, sans identifiants embarqués. L'ancienne API dépréciée est explicitement refusée. Les durées et limites invalides échouent à la construction. Les scripts CLI/live utilisent la prise en charge des proxies d'environnement de Node 24 ; aucun proxy n'est requis hors d'un environnement qui en impose un.

## Commandes et CI

```bash
npm ci
npm run typecheck
npm test
npm run test:geocoding
npm run demo:geocode -- "10 rue de la Paix Paris"
npm run demo:geocode -- --autocomplete "12 rue vict"
npm run demo:geocode -- --reverse 48.8566 2.3522
npm run test:geocoding:live
```

npm test inclut tous les tests hors réseau. La suite live réalise exactement 5 requêtes vers des lieux publics (Paris, Lyon, Nantes, reverse Paris et autocomplete Lyon), avec 10 s de timeout, 2/s, aucun retry ; elle ne participe pas à la CI principale. Aucun résultat exact textuel n'est imposé, seulement présence, structure et coordonnées dans l'emprise attendue.

Le workflow principal conserve PostgreSQL/PostGIS et ses étapes ; les tests géocodage hors réseau entrent automatiquement dans npm test. Le workflow `Geocoding live - manual only` se lance uniquement depuis Actions → Run workflow. Il est rouge si l'API échoue, mais son échec ne rend pas le workflow principal rouge. Les résultats live observés et les limites sont consignés dans TEST_RESULTS.md.
