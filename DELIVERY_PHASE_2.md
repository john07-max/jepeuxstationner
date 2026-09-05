# Livraison PHASE 2

**30 fichiers ajoutés, 14 fichiers modifiés.** Aucun fichier source supprimé ni architecture remplacée. Les inventaires ci-dessous excluent dépendances et compilation générée.

## Ajoutés

- `.github/workflows/dialog-live.yml`
- `DELIVERY_PHASE_2.md`
- `DIALOG.md`
- `apps/demo/src/sync-dialog.ts`
- `docs/validation/PHASE_1_WORK_RESULTS.md`
- `docs/validation/phase2-captured-feed.log`
- `docs/validation/phase2-demo.log`
- `docs/validation/phase2-dialog-live.log`
- `docs/validation/phase2-npm-ci.log`
- `docs/validation/phase2-typecheck.log`
- `docs/validation/phase2-unit-tests.log`
- `packages/adapters/src/dialog/adapter.ts`
- `packages/adapters/src/dialog/http.ts`
- `packages/adapters/src/dialog/parser.ts`
- `packages/adapters/src/dialog/types.ts`
- `packages/database/migrations/003_imported_restrictions.sql`
- `packages/database/queries/dialog-at-position.sql`
- `packages/database/src/dialog.ts`
- `packages/domain/src/imported-rule.ts`
- `tests/dialog.test.ts`
- `tests/fixtures/dialog/dialog-invalid.xml`
- `tests/fixtures/dialog/dialog-multiple.xml`
- `tests/fixtures/dialog/dialog-parking-active.xml`
- `tests/fixtures/dialog/dialog-parking-expired.xml`
- `tests/fixtures/dialog/dialog-parking-future.xml`
- `tests/fixtures/dialog/dialog-parking-permanent.xml`
- `tests/fixtures/dialog/dialog-recurrence.xml`
- `tests/fixtures/dialog/dialog-unknown-restriction.xml`
- `tests/integration/dialog.test.ts`
- `tests/live/dialog.live.test.ts`

## Modifiés

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

## Architecture et résultat

Détails du flux, endpoint/paramètres vérifiés, structures et types observés, mapping, stratégie géométrique/temporelle, fraîcheur et idempotence : DIALOG.md. Décisions ADR-026 à 036 : DECISIONS.md.

Résultat local : npm ci, typecheck, 187 tests offline et demo réussis ; test DiaLog live 1/1 réussi. 44 tests offline, 18 tests PostgreSQL et 1 live ajoutés. Les 18 nouveaux tests PostgreSQL ne sont pas encore exécutés. Voir TEST_RESULTS.md et logs joints.

## Structure exacte du workflow principal

Déclencheurs : push, pull_request, workflow_dispatch. Job ubuntu-24.04, Node 24, timeout 15 min, bash avec pipefail ; aucune API externe.

1. Checkout.
2. Setup Node 24, cache npm.
3. Création du dossier de logs.
4. npm ci.
5. Démarrage Compose PostgreSQL 17 / PostGIS 3.5.
6. Attente d'une connexion SQL réelle.
7. pg_extension et PostGIS_Version().
8. Migrations, dont 003.
9. Rejeu sans changement.
10. Tests SQL/PostGIS.
11. Tests intégration historiques et 18 nouveaux DiaLog ; EXPLAIN DiaLog inclus.
12. EXPLAIN historique sur les zones.
13. TypeScript strict.
14. Tous les tests unitaires, géocodage et DiaLog offline.
15. Démonstration fictive.
16. Logs PostgreSQL, même en cas d'échec.
17. Archivage des preuves, même en cas d'échec.
18. Arrêt et suppression de la base éphémère.

Toute étape de validation en échec fait échouer la CI. Workflow DiaLog live manuel indépendant : checkout → Node 24 → npm ci → un test réseau → archive des logs. Le workflow géocodage live existant est conservé.

## Variables nécessaires

Aucune clé API. CI : DATABASE_URL et POSTGRES_PASSWORD de test définis dans le workflow. Pour un import hors CI : DATABASE_URL vers PostgreSQL/PostGIS migré ; POSTGRES_PASSWORD seulement si Compose est utilisé. DIALOG_TIMEOUT_MS=60000, DIALOG_FRESHNESS_MS=86400000, DIALOG_MAX_BYTES=134217728 et DIALOG_SPATIAL_TOLERANCE_METERS=5 sont facultatifs, avec ces défauts. Les variables géocodage existantes restent inchangées.

## Mise en ligne extrêmement simple avec GitHub Desktop

1. Décompresser l'archive de livraison.
2. Copier **le contenu** de jepeuxstationner dans votre dossier de dépôt existant. Accepter le remplacement ; conserver votre dossier .git et votre .env. Ne pas imbriquer un second dossier jepeuxstationner.
3. Ouvrir GitHub Desktop sur le dépôt john07-max/jepeuxstationner.
4. Écrire « PHASE 2 DiaLog » dans Summary, cliquer **Commit to main**, puis **Push origin**.
5. Sur GitHub, ouvrir **Actions**, puis **CI - PostGIS geocoding DiaLog**. Attendre la fin. Une coche verte doit apparaître pour l'exécution complète et les étapes de validation.
6. Pour confirmer aussi le réseau depuis GitHub : choisir **DiaLog live (manual)**, **Run workflow**, puis le bouton vert **Run workflow**.

## À renvoyer pour analyse

- Lien de l'exécution CI, commit SHA et statut final.
- Archive **postgis-validation-…** disponible dans Artifacts au bas de l'exécution.
- Priorité aux fichiers migrations.log, migrations-replay.log, postgis-version.log, sql-tests.log, integration.log (scénarios DiaLog, compteurs et plan), explain.log, spatial-plan.json et unit-tests.log.
- Archive **dialog-live-…** du workflow séparé si lancé.
- En cas d'échec : nom de l'étape rouge et son log complet ; une simple capture de la coche ne permet pas d'analyser le plan SQL.

```bash
npm ci
npm run validate
npm run test:dialog:live
# Avec une base PostGIS disponible :
npm run validate:db
npm run sync:dialog -- --dry-run
npm run sync:dialog
```

```text
READY FOR PHASE 3: NO
Reason: Phase 2 PostgreSQL/PostGIS integration and GitHub CI validation pending.
```

Aucune PHASE 3 commencée.
