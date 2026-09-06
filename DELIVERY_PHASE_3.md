# Livraison PHASE 3 — pilote Lyon

Le dernier document joint confirme les phases précédentes et autorise le pilote Lyon. L'architecture existante et la correction d'idempotence DiaLog sont conservées. Cette livraison termine le travail réalisable dans Work ; elle ne constitue pas une validation de mise en production.

## Résultat

- 249 tests unitaires réussis, TypeScript et démonstration réussis ; npm ci exécuté.
- 54 unités et 17 intégrations PostGIS ajoutées ; 3 contrôles live ajoutés.
- Total défini : 316 tests (249 unités, 58 intégrations, 9 live), hors assertions SQL. Ce n'est pas un total exécuté.
- Audit live Lyon : 2 réussis (statique, axes), 1 échoué (temps réel HTTP 401).
- PostgreSQL, PostGIS, migrations, SQL, intégration et EXPLAIN **non exécutés**. Les commandes ont échoué faute de DATABASE_URL ; aucun serveur installé dans Work.
- 1 142 voies extraites, 1 103 axes rapprochés (96,58 %), 0 ambigu, 39 sans correspondance. **Zéro emplacement réellement certifié.**
- 189 parkings statiques normalisés, 32 explicitement tous publics, zéro observation temps réel réelle.

Voir TEST_RESULTS.md pour les résultats exacts et docs/validation/phase3-* pour les preuves.

## Audit, règles, modèles et limites

LYON_AUDIT.md contient les sources municipales et métropolitaines, les URLs utilisées, les licences et les résultats d'accès. LYON.md détaille les 19 éléments de livraison demandés : audit/endpoints/licences, fichiers, architecture, couverture, règles, prix, parkings, fréquence, fraîcheur, tests, limites et commandes. Le rapport de rapprochement individuel est data/lyon/coverage-report.json ; manifeste SHA256 et captures officielles accompagnent le code.

Règles effectivement normalisées : voitures visiteuses UNO, horaires 9–19h, dimanches/fériés, août visiteur payant, catégories tarifaires par énergie/masse, priorité des interdictions spécifiques DiaLog et échéance d'une interdiction future. Les paliers publiés sont versionnés ; aucun montant sans profil adapté ni interpolation.

Non intégrés comme couverture de production : places matérialisées, voies partielles, droits résident/artisan et autres dérogations, NOCTURNE. Les exceptions datées sont représentables mais aucun droit particulier n'est supposé. Un axe n'est pas un emplacement. Le mapping temps réel est préparé, sans nom de champ deviné.

L'actualisation à la minute est annoncée pour LPA ; seuil configurable de 180 secondes par défaut. Les observations anciennes deviennent UNKNOWN sans supprimer le parking. Le calendrier juridique exige une revue avant le 06/10/2026 ; axes frais au plus 7 jours. Ces durées ne sont pas renouvelées par la simple lecture d'une archive.

## Structure du dépôt ajoutée

```text
packages/domain/src/local-parking.ts
packages/adapters/src/lyon/
  adapter.ts  calendar.ts  config.ts  facilities.ts
  pricing.ts  realtime.ts  streets.ts
packages/application/src/
  check-parking.ts  lyon.ts
packages/database/
  migrations/004_lyon.sql
  queries/nearby-facilities.sql
  src/lyon.ts
apps/demo/src/
  check-parking.ts  sync-lyon.ts
data/lyon/
  streets.json  roads.geojson  facilities.geojson
  sources.json  manifest.json  coverage-report.json  README.md
tests/
  lyon.test.ts  lyon-service.test.ts
  integration/lyon.test.ts  live/lyon.live.test.ts
scripts/extract-lyon-annex.py
.github/workflows/lyon-live.yml
```

Les autres composants restent en place. Les décisions importantes sont ADR-038 à ADR-048 dans DECISIONS.md. La seule adaptation du moteur central est générique : scope=GENERAL et priorité limitée d'une interdiction officielle spécifique. Les conflits entre règles spécifiques conservent UNKNOWN.

## Workflow CI exact

Déclencheurs : push, pull_request, workflow_dispatch. Job validate sur ubuntu-24.04, limite 15 minutes, Node 24. Base jetable PostgreSQL 17/PostGIS 3.5 via compose.yaml. Shell bash avec échec des pipelines propagé. Aucun appel aux APIs métier.

1. Checkout du dépôt.
2. Configuration Node.js 24 et cache npm.
3. Création du dossier de logs artifacts.
4. npm ci.
5. npm run db:up : démarrage Docker Compose.
6. npm run db:wait : vraie connexion SQL prête.
7. npm run db:check : extension postgis et PostGIS_Version().
8. npm run db:migrate : migrations 001–004.
9. Nouvelle exécution db:migrate : aucun changement attendu.
10. npm run test:db : assertions SQL/PostGIS.
11. npm run test:integration : 58 scénarios définis, dont Lyon A–F, proximité, performance et plan de requête.
12. npm run db:explain : plan spatial historique.
13. npm run typecheck.
14. npm test : 249 unités.
15. npm run lyon:coverage -- --file data/lyon/roads.geojson : rapprochement sans réseau.
16. npm run demo : données fictives.
17. Toujours : collecte des logs du conteneur.
18. Toujours : archive postgis-validation-<run_id>, conservée 14 jours.
19. Toujours : arrêt de la base jetable et suppression de son volume.

Le workflow manuel indépendant « Lyon live audit (manual) » fait checkout, Node 24, npm ci, trois contrôles officiels, puis archive lyon-live-<run_id>. Son échec temps réel est visible et ne bloque pas la CI hors réseau.

## Variables d'environnement

- DATABASE_URL : nécessaire aux migrations, synchronisations et services DB. Dans CI : postgresql://parking:ci-ephemeral-password@127.0.0.1:5432/parking, base jetable uniquement.
- POSTGRES_PASSWORD : ci-ephemeral-password, configuré dans le workflow jetable ; choisir une autre valeur pour votre environnement personnel.
- PARKING_REALTIME_MAX_AGE : 180 secondes par défaut, plage 60–900.
- LYON_REALTIME_MAPPING : facultative et vide tant que le schéma officiel n'est pas revu ; nécessaire uniquement à l'audit complet temps réel et à --realtime. Champs id/available/updatedAt, occupied optionnel, evidenceUrl officiel. Ne pas copier des noms de champs supposés.
- Les variables géocodage et DiaLog existantes de .env.example restent utilisables. Aucune nouvelle clé API ou donnée personnelle requise.

Ne jamais publier votre fichier .env. GitHub CI dispose déjà de ses variables de base jetable : aucun secret PostgreSQL à ajouter pour lancer la CI.

## Pousser sur GitHub, simplement

1. Télécharger et extraire JePeuxStationner-phase3-lyon.zip.
2. Ouvrir votre dépôt actuel dans GitHub Desktop, puis « Repository → Show in Explorer/Finder ».
3. Copier le **contenu** du dossier jepeuxstationner extrait dans ce dossier existant ; accepter le remplacement des fichiers. Ne pas imbriquer un second dossier jepeuxstationner. Conserver votre dossier .git et votre .env. Inclure le dossier .github de l'archive.
4. Dans GitHub Desktop, saisir « Add Phase 3 Lyon pilot », puis cliquer **Commit to main** et **Push origin**.
5. Ouvrir https://github.com/john07-max/jepeuxstationner/actions et attendre **CI - PostGIS geocoding DiaLog Lyon**. Il démarre après le push. Si besoin, sélectionner ce workflow puis **Run workflow**.
6. Cliquer sur l'exécution puis le job : une réussite complète affiche une coche verte, sans étape essentielle ignorée. Ouvrir les étapes PostGIS, migrations et intégration pour vérifier les résultats.
7. Télécharger l'archive **postgis-validation-...** en bas de la page d'exécution, section Artifacts.
8. Lancer séparément **Lyon live audit (manual) → Run workflow**. Télécharger **lyon-live-...**, même si le contrôle temps réel échoue. Si HTTP 200 permet de voir les champs, me transmettre le log avant de renseigner un mapping.

En ligne de commande, dans le dépôt existant :

```bash
git add .
git commit -m "Add Phase 3 Lyon pilot"
git push
```

Le badge README cible le workflow de ce dépôt. Une CI principale verte ne suffit pas à activer des places sans preuves géographiques, ni à valider un flux temps réel inaccessible.

## Résultats à me renvoyer

- Le lien exact de l'exécution CI, son statut et le commit testé.
- L'archive postgis-validation-... contenant les versions PostGIS, migrations, SQL, integration.log, unit-tests.log, explain.log et lyon-coverage.json.
- L'archive lyon-live-... ou son log complet : code HTTP, schéma observé et erreur de fraîcheur éventuelle.
- En cas d'échec, le nom de la première étape rouge et la trace complète, pas seulement la dernière ligne.

Les mesures recherchées dans integration.log sont lyon.offline.performance et lyon.nearby.plan ; elles doivent venir de PostgreSQL réel, pas d'une estimation Work.

## Fichiers ajoutés

- `.github/workflows/lyon-live.yml`
- `LYON.md`
- `LYON_AUDIT.md`
- `apps/demo/src/check-parking.ts`
- `apps/demo/src/sync-lyon.ts`
- `data/lyon/README.md`
- `data/lyon/coverage-report.json`
- `data/lyon/facilities.geojson`
- `data/lyon/manifest.json`
- `data/lyon/roads.geojson`
- `data/lyon/sources.json`
- `data/lyon/streets.json`
- `docs/validation/phase3-db-attempts.json`
- `docs/validation/phase3-db-check.log`
- `docs/validation/phase3-db-explain.log`
- `docs/validation/phase3-db-migrate.log`
- `docs/validation/phase3-demo.log`
- `docs/validation/phase3-lyon-live.log`
- `docs/validation/phase3-lyon-unit.log`
- `docs/validation/phase3-npm-ci.log`
- `docs/validation/phase3-test-db.log`
- `docs/validation/phase3-test-integration.log`
- `docs/validation/phase3-typecheck.log`
- `docs/validation/phase3-unit.log`
- `packages/adapters/src/lyon/adapter.ts`
- `packages/adapters/src/lyon/calendar.ts`
- `packages/adapters/src/lyon/config.ts`
- `packages/adapters/src/lyon/facilities.ts`
- `packages/adapters/src/lyon/pricing.ts`
- `packages/adapters/src/lyon/realtime.ts`
- `packages/adapters/src/lyon/streets.ts`
- `packages/application/package.json`
- `packages/application/src/check-parking.ts`
- `packages/application/src/lyon.ts`
- `packages/database/migrations/004_lyon.sql`
- `packages/database/queries/nearby-facilities.sql`
- `packages/database/src/lyon.ts`
- `packages/domain/src/local-parking.ts`
- `scripts/extract-lyon-annex.py`
- `tests/fixtures/lyon/facilities.geojson`
- `tests/integration/lyon.test.ts`
- `tests/live/lyon.live.test.ts`
- `tests/lyon-service.test.ts`
- `tests/lyon.test.ts`
- `DELIVERY_PHASE_3.md`

## Fichiers modifiés

- `.env.example`
- `.github/workflows/ci.yml`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `DATA_SOURCES.md`
- `DECISIONS.md`
- `PARKING_RULE_ENGINE.md`
- `README.md`
- `TEST_RESULTS.md`
- `package-lock.json`
- `package.json`
- `packages/domain/src/index.ts`
- `packages/engine/src/index.ts`
- `scripts/db.mjs`

## Statut

**READY FOR PHASE 4: NO** — CI PostgreSQL/PostGIS PHASE 3 à exécuter, couverture de places certifiées absente, accès et schéma temps réel restant à vérifier. Aucune PHASE 4 commencée.
