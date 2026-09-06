# Livraison PHASE 4.5 — Railway

Préparation uniquement. Aucun compte Railway modifié, aucune base créée, aucun déploiement lancé. La PHASE 5 n'est pas commencée.

## Commandes et architecture

Root Directory : `/` (package.json et workspaces à la racine). Dockerfile Node 24, installation `npm ci --include=dev`, build `npm run build`, démarrage `npm start`, écoute `0.0.0.0:$PORT`. Aucun railway.json ou nixpacks.toml requis. Le Dockerfile conserve scripts, SQL, données et compilateur requis par les synchronisations existantes.

Migrations : `npm run db:migrate`. Précommande Railway du site : `npm run db:migrate && npm run db:check`. Aucun reset ; PostGIS activé par migration 001 et vérifié explicitement.

Synchronisations : `npm run sync:lyon:boundary`, `npm run sync:lyon:parking-rules`, `npm run sync:lyon:facilities`, `npm run sync:dialog`. Commande groupée pour le service Sync-Lyon : `npm run staging:sync`. Le marqueur STAGING_SYNC_COMPLETE n'apparaît qu'après toutes les étapes réussies.

Variables site : DATABASE_URL par référence `${{PostGIS.DATABASE_URL}}`, APP_ORIGIN correspondant au domaine HTTPS public. PORT est injecté par Railway. Base Docker : POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD créé hors Git, PGDATA et DATABASE_URL construite dans Railway. Tableau exact et options dans DEPLOYMENT.md.

## Résultat réel

npm ci et build production réussis ; TypeScript réussi ; **299/299 tests locaux passent**. Démarrage production avec PORT=4191, /api/health et page web HTTP 200 contrôlés réellement. Demo et rapprochement Lyon local réussis. Inventaire total : 380 tests JS/TS, dont 60 intégrations et 21 E2E à exécuter par la CI. Aucune validation locale PostgreSQL/PostGIS ou Docker revendiquée.

CI historique conservée ; ajout d'un test PostGIS de bootstrap administratif et de deux étapes build/smoke Docker. La nouvelle CI devra être verte avant de suivre le déploiement. Aucun workflow GitHub n'a été déclenché par Work.

## Procédure simple

1. Copier les fichiers, Commit puis Push origin et attendre la CI.
2. Railway → New Project → GitHub repo → john07-max/jepeuxstationner.
3. Ajouter l'image postgis/postgis:17-3.5 avec volume persistant et variables privées.
4. Connecter DATABASE_URL au site, régler migrations et health check.
5. Generate Domain, vérifier APP_ORIGIN, Deploy.
6. Ajouter Sync-Lyon depuis le même dépôt, Start Command npm run staging:sync, pas de health check, Restart Policy Never. Déployer une première fois, puis régler le cron six heures.
7. Vérifier les logs, /api/health et /api/ready, puis ouvrir l'URL sur téléphone.

**Guide illustré par les noms de menus et valeurs exactes : DEPLOYMENT.md.** Aucun logiciel local de base de données nécessaire.

## Points à surveiller

Le bootstrap du contour évite la panne d'une base neuve mais ne crée pas de places certifiées. Sans ces preuves, UNKNOWN est attendu même après import des voies/DiaLog ; aucune modification des garde-fous métier. Le temps réel reste optionnel, revue et accès à vérifier. Revue réglementaire existante jusqu'au 6 octobre 2026. Prévoir mémoire suffisante pour le flux DiaLog, surveiller coûts et sauvegardes Railway. Health ne certifie ni fraîcheur ni couverture. Les mentions légales restent à compléter avant diffusion large.

Le dépôt est préparé pour un déploiement de préproduction. Cela ne signifie ni « déployé » ni « données métier complètes » ; l'image, les accès et les imports seront validés dans les environnements autorisés.

## Fichiers ajoutés

- `.dockerignore`
- `Dockerfile`
- `docs/validation/phase45-build.log`
- `docs/validation/phase45-coverage.log`
- `docs/validation/phase45-demo.log`
- `docs/validation/phase45-npm-ci.log`
- `docs/validation/phase45-production-smoke.log`
- `docs/validation/phase45-results.json`
- `docs/validation/phase45-typecheck.log`
- `docs/validation/phase45-unit.log`
- `scripts/lyon-boundary.mjs`
- `tests/lyon-boundary.test.ts`
- `DELIVERY_PHASE_4_5.md`

## Fichiers modifiés

- `.github/workflows/ci.yml`
- `CHANGELOG.md`
- `DATA_SOURCES.md`
- `DECISIONS.md`
- `DEPLOYMENT.md`
- `README.md`
- `TEST_RESULTS.md`
- `package.json`
- `tests/integration/lyon.test.ts`

READY FOR RAILWAY STAGING: YES
