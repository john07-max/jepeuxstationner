# Livraison PHASE 0.5

Architecture de la PHASE 0 conservée. Modifications importantes : ADR-012 à ADR-018. compose.yaml, migration 001, requête spatiale principale, fournisseur fictif et tsconfig conservés. Aucun lancement de PHASE 1.

## Fichiers ajoutés

- DELIVERY_PHASE_0_5.md
- STATIC_DB_REVIEW.md
- TEST_MATRIX.md
- packages/database/fixtures/integration.sql
- packages/database/fixtures/spatial-plan.sql
- packages/database/migrations/002_permanent_rules.sql
- packages/database/queries/load-coverage.sql
- packages/database/queries/load-rules.sql
- packages/database/src/read-snapshots.ts
- packages/database/tests/geospatial.sql
- packages/database/tests/temporal.sql
- scripts/db.mjs
- tests/db-scripts.test.ts
- tests/integration/database-engine.test.ts

## Fichiers modifiés

- .env.example
- .github/workflows/ci.yml
- .gitignore
- ARCHITECTURE.md
- CHANGELOG.md
- DATA_SOURCES.md
- DECISIONS.md
- PARKING_RULE_ENGINE.md
- README.md
- ROADMAP.md
- TEST_RESULTS.md
- package-lock.json
- package.json
- packages/domain/src/index.ts
- packages/engine/src/index.ts
- tests/engine.test.ts

## Workflow exact

1. Checkout repository
2. Configure Node.js 24
3. Prepare logs
4. Install locked dependencies
5. Start PostgreSQL 17 and PostGIS 3.5
6. Wait for a real SQL connection
7. Verify installed PostGIS extension and version
8. Apply migrations 001 and 002
9. Check migration replay is a no-op
10. SQL and PostGIS tests
11. Real database to engine integration A B C
12. Spatial query EXPLAIN ANALYZE BUFFERS
13. TypeScript strict
14. Unit tests
15. Fictional demo
16. Collect database container logs
17. Upload validation evidence
18. Stop disposable CI database

Déclenchement push, pull_request ou workflow_dispatch ; un job Ubuntu 24.04, Node 24, timeout 15 minutes, permissions contents:read. Les étapes shell utilisent bash avec pipefail : tee ne masque pas les erreurs. Les trois dernières étapes tournent avec always() pour récupérer les preuves et nettoyer le volume CI ; elles ne rendent pas un job échoué vert. Aucun continue-on-error.

## Variables

POSTGRES_PASSWORD et DATABASE_URL sont déjà définies dans le workflow pour la base jetable. Aucun secret GitHub à ajouter. En local équipé : copier .env.example et changer les deux mots de passe concordants. ALLOW_DB_RESET reste absente sauf remise à zéro volontaire d'une base locale jetable.

## Résultats et étapes utilisateur

50 tests locaux réussis, compilation stricte et démo réussies ; aucune validation runtime PostgreSQL/PostGIS. Voir TEST_RESULTS.md pour la séparation complète. Voir README.md, section « Validation avec GitHub Actions », pour la création du dépôt, les six commandes git, l'onglet Actions et le téléchargement des logs.

Renvoyer l'URL d'exécution, le commit, le statut et l'archive postgis-validation-<numéro>. En cas d'échec, joindre surtout le message de la première étape rouge. Pour le plan : examiner usesSpatialIndex et l'arbre complet de spatial-plan.json, pas seulement l'existence du fichier.

```text
READY FOR PHASE 1: NO
Reason: PostgreSQL/PostGIS runtime validation pending.
```
