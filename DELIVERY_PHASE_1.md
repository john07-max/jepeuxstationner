# Livraison PHASE 1

Géocodage Géoplateforme/BAN uniquement. Architecture stationnement conservée, aucun nouveau package npm, aucun changement moteur/migration/base. Voir GEOCODING.md, DECISIONS.md (ADR-019 à ADR-025) et TEST_RESULTS.md.

## Fichiers ajoutés

- .github/workflows/geocoding-live.yml
- DELIVERY_PHASE_1.md
- GEOCODING.md
- apps/demo/src/geocode.ts
- docs/validation/PHASE_0_5_WORK_RESULTS.md
- docs/validation/phase1-geocode-cli.log
- docs/validation/phase1-geocoding-live.log
- docs/validation/phase1-npm-ci.log
- docs/validation/phase1-parking-demo.log
- docs/validation/phase1-typecheck.log
- docs/validation/phase1-unit-tests.log
- packages/adapters/src/geocoding/autocomplete.ts
- packages/adapters/src/geocoding/cache.ts
- packages/adapters/src/geocoding/config.ts
- packages/adapters/src/geocoding/provider.ts
- packages/adapters/src/geocoding/transport.ts
- packages/domain/src/geocoding.ts
- tests/fixtures/geocoding.ts
- tests/geocoding.test.ts
- tests/live/geocoding.live.test.ts

## Fichiers modifiés

- .gitignore
- .env.example
- .github/workflows/ci.yml
- ARCHITECTURE.md
- CHANGELOG.md
- DATA_SOURCES.md
- DECISIONS.md
- PRIVACY.md
- README.md
- ROADMAP.md
- TEST_RESULTS.md
- package.json


## Tests et limites

93 nouveaux tests hors réseau ; total 143/143 réussis. Cinq tests live définis et exécutés : trois réussites (Lyon, reverse Paris, autocomplete Lyon), deux timeouts (Paris/Nantes). Démo CLI Paris tentée : TIMEOUT. Les logs sont inclus. CI complète de cette nouvelle révision à relancer sur GitHub.

Cache RAM 500 entrées, 24 h positif / 30 s vide ; aucune erreur conservée. Débit 5/s/processus partagé par origine, timeout 5 s/tentative, un retry sur timeout/réseau/502/503/504 ; 429 respecte Retry-After via cooldown et erreur typée. Les adresses ne sont pas persistées ou associées à une IP/identité.

La couverture nationale du géocodage n'est pas une couverture nationale du stationnement. Les localisants approximatifs ne déterminent pas un côté de chaussée. Filtre bounds limité aux 50 candidats renvoyés ; coordination de débit inter-processus nécessaire avant réplication.

## Mise à jour GitHub

Remplacer le contenu de la copie locale sans supprimer .git ni .env, puis git add ., git commit et git push. La CI principale se déclenche au push. Le workflow Geocoding live - manual only se lance séparément avec Run workflow. Renvoyer les liens et les deux artefacts de validation pour analyse.

```text
READY FOR PHASE 2: NO
Reason: Current revision CI revalidation pending; live geocoding suite has two timeouts.
```
