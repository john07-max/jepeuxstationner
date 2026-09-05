# Résultats PHASE 0.5 — 2026-09-05

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK

Environnement observé : Node.js 24.19.0, npm 11.9.0, TypeScript 5.9.3. Aucune installation ou exécution de Docker/PostgreSQL tentée pendant la PHASE 0.5.

| Commande / contrôle réellement exécuté | Résultat réel |
| --- | --- |
| npm ci | Réussi, code 0 ; 23 packages installés à partir du lockfile |
| npm run typecheck | Réussi, code 0, aucune erreur TypeScript |
| npm test — exécution finale | Réussi, code 0 : 50 tests, 50 réussis, 0 échec, 0 ignoré |
| npm run demo | Réussi, code 0 : ALLOWED fictif, synthetic=true, engineVersion=0.0.2 et preuves présentes |
| node --check scripts/db.mjs | Syntaxe JavaScript acceptée |
| Parsing YAML compose.yaml / ci.yml | Syntaxe parsée ; inspection des 18 étapes et cohérence des variables |
| Revue statique SQL/configuration | Réalisée, voir STATIC_DB_REVIEW.md ; aucune exécution SQL |

Les 50 tests locaux se décomposent en 42 tests moteur/chaîne mémoire et 8 tests de garde-fous sans connexion. Un de ces garde-fous lance volontairement le point d'entrée d'intégration SANS DATABASE_URL et exige son échec : ce n'est PAS une exécution des 19 tests sur PostgreSQL.

Historique de correction pendant cette phase : une première exécution a donné 49 réussites et 1 échec dans le garde-fou du sous-processus Node. NODE_TEST_CONTEXT hérité perturbait le runner enfant ; il a été retiré de l'environnement de ce seul sous-processus. Après correction, compilation et suite complète ont réussi (50/50), puis la démonstration a réussi.

npm run validate est fourni comme composition des trois commandes locales typecheck/test/demo ; il n'est pas présenté comme une validation de base. Les contrôles statiques ne permettent pas de conclure que les requêtes ou migrations fonctionneront à l'exécution.

## TESTS PRÉPARÉS POUR GITHUB ACTIONS MAIS NON ENCORE EXÉCUTÉS

| Validation préparée | État |
| --- | --- |
| Démarrage PostgreSQL 17 via Compose et connexion SQL authentifiée | NON EXÉCUTÉ |
| PostGIS 3.5, pg_extension et PostGIS_Version() | NON EXÉCUTÉ |
| Migrations 001 puis 002, contraintes et rejeu du runner | NON EXÉCUTÉ |
| Tests SQL/PostGIS : 23 assertions prévues | NON EXÉCUTÉ |
| Intégration PostgreSQL/PostGIS → ParkingRule[] → moteur : 19 tests | NON EXÉCUTÉ |
| Scénario A : FORBIDDEN | NON EXÉCUTÉ SUR BASE |
| Scénario B : CONDITIONAL et mustLeaveBefore | NON EXÉCUTÉ SUR BASE |
| Scénario C : UNKNOWN | NON EXÉCUTÉ SUR BASE |
| Index GiST et EXPLAIN ANALYZE BUFFERS sur 40 000 zones | NON EXÉCUTÉ |
| Reset destructif de base locale jetable | NON EXÉCUTÉ ; seuls ses refus ont été testés sans connexion |
| Workflow GitHub Actions complet | NON LANCÉ : aucun dépôt GitHub cible fourni |

Aucune réussite runtime PostgreSQL/PostGIS n'est revendiquée. Aucune base factice ou mock ne remplace PostgreSQL dans les tests d'intégration. L'absence de base ou d'extension fera échouer les commandes DB.

## Statut

```text
READY FOR PHASE 1: NO
Reason: PostgreSQL/PostGIS runtime validation pending.
```

La prochaine preuve attendue est une exécution GitHub Actions verte avec logs de versions, migrations, assertions, décisions A/B/C et plan spatial. Aucun travail de PHASE 1 n'a commencé.
