# Résultats du correctif d'idempotence — 2026-09-06

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK

- npm run typecheck : code 0.
- npm test : code 0, **195/195 tests réussis**, 0 ignoré ; 187 tests précédents conservés et 8 nouveaux tests de fingerprint.
- npm run test:integration : compilation réussie, code 1 au démarrage, DATABASE_URL absente. **Aucun scénario PostgreSQL exécuté.**
- npm run test:db : code 1, DATABASE_URL absente, aucune exécution SQL.
- npm run db:check : code 1, même absence de configuration, aucune vérification runtime PostGIS.
- npm run db:explain : code 1, aucune exécution EXPLAIN.

Les logs de ces commandes sont dans docs/validation/idempotence-*.log. Une erreur TypeScript initiale dans un nouveau test (réaffectation d'une propriété readonly) a été corrigée avant ces résultats finaux. Aucun Docker/PostgreSQL installé, aucun test live rejoué pendant ce correctif.

## TESTS PRÉPARÉS POUR GITHUB ACTIONS MAIS NON ENCORE EXÉCUTÉS

Les 37 scénarios PostgreSQL précédents, dont l'idempotence initiale et la modification de date de fin, sont conservés. Quatre nouveaux scénarios vérifient récupération ultérieure, JSON réordonné, modification géométrique et absence effective de réécriture. Soit **41 tests d'intégration PostgreSQL définis**, à exécuter réellement dans CI avec tests SQL, PostGIS et EXPLAIN existants.

Total défini : **195 offline + 41 intégration + 6 live = 242 tests** (hors assertions SQL). Ce total ne signifie pas 242 tests exécutés. La CI principale découvrira les nouveaux tests automatiquement, sans modification du workflow.

```text
READY FOR PHASE 3: NO
Reason: Idempotence PostgreSQL runtime validation and full GitHub CI pending.
```

---

# Historique de la livraison PHASE 2 avant ce correctif

# TEST_RESULTS — PHASE 2 — 2026-09-05

Les PHASES 0/0.5/1 sont validées selon la confirmation CI verte fournie par l'utilisateur. Cela n'est pas présenté comme une inspection indépendante des logs GitHub. Le rapport Work historique PHASE 1 est conservé dans docs/validation/PHASE_1_WORK_RESULTS.md.

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK

| Commande / contrôle | Résultat réel final |
| --- | --- |
| npm ci | code 0, 25 packages installés |
| npm run typecheck | code 0, TypeScript strict |
| npm test | code 0 : **187 tests réussis**, 0 échec, 0 ignoré |
| npm run demo | code 0, décision fictive, moteur 0.0.3 |
| npm run test:dialog:live | code 0 : **1/1 test réussi**, un seul appel officiel |
| Relecture du téléchargement officiel avec le parser final | code 0 : 11 042 arrêtés, 9 675 règles, 0 invalide |

Les 187 tests offline se répartissent en 143 tests précédents conservés (dont 93 géocodage) et **44 nouveaux tests DiaLog**. Le géocodage live n'a pas été rejoué pendant la PHASE 2.

Le téléchargement d'observation puis le test live constituent deux appels HTTP au total. Export de 100 072 501 octets ; 7 322 règles supportées, les autres explicitement limitées. Le live prend environ 23,7 s (boucle lecture/parsing ~4,0 s), RSS finale 272,5 Mo ; ce n'est pas une mesure garantie de mémoire maximale. La relecture locale du même export avec le parser final prend ~3,0 s et ne fait aucun appel réseau.

Preuves : docs/validation/phase2-npm-ci.log, phase2-typecheck.log, phase2-unit-tests.log, phase2-demo.log, phase2-dialog-live.log, phase2-captured-feed.log. Le XML national temporaire n'est pas livré ni stocké en base.

Pendant le développement, un test attendait une erreur XML sur une racine déjà rejetée comme SCHEMA ; corrigé pour utiliser un véritable document DATEX tronqué. Les résultats finaux ci-dessus viennent d'une exécution complète après correction. L'avertissement npm sur la configuration http-proxy de Work n'empêche pas l'installation.

Les garde-fous de scripts DB inclus dans npm test ne se connectent pas à PostgreSQL et ne sont pas une validation PostGIS.

## TESTS PRÉPARÉS POUR GITHUB ACTIONS MAIS NON ENCORE EXÉCUTÉS

- PostgreSQL 17 / PostGIS 3.5 de cette révision, disponibilité réelle de l'extension.
- Migration additive 003 et rejeu des migrations ; contraintes et index.
- Tests SQL historiques géospatiaux/temporels.
- **18 nouveaux tests d'intégration DiaLog réels**, dans un schéma privé créé puis supprimé : XML → parser → PostGIS → requête → ParkingRule → moteur.
- Scénarios A à E, permanent, idempotence, mise à jour, désactivation, dry-run sans écriture, erreurs partielles, géométrie invalide et rollback, tolérance métrique, coordonnées inversées, bordure ST_Covers, récurrence non supportée, MultiPolygon/SRID.
- EXPLAIN ANALYZE BUFFERS sur 20 000 lignes supplémentaires DiaLog ; temps d'import et requête à récupérer dans integration.log.
- Tests d'intégration historiques (19) et EXPLAIN historique 40 000 zones.
- Workflow CI principal complet après le push et workflow live manuel depuis GitHub.

Bilan des tests ajoutés : **44 offline + 18 PostgreSQL + 1 live = 63**. Suites du dépôt : 187 offline, 37 intégration PostgreSQL, 6 live (5 géocodage + 1 DiaLog), soit **230 tests définis**. Ce total n'est pas un total de tests exécutés dans Work.

Inspection statique : Compose conservé, PostgreSQL 17 / PostGIS 3.5 cohérents ; migration 003 additive et enregistrée ; reset adapté ; requête paramétrée EPSG:4326, geography en mètres, ST_Covers sur surfaces ; disponibilité PostGIS explicite conservée dans CI. Cette inspection n'est pas une validation d'exécution SQL.

Aucune installation ni exécution de Docker/PostgreSQL tentée dans Work. La commande sync et son dry-run nécessitent une base et n'ont donc pas été exécutés ici.

```text
READY FOR PHASE 3: NO
Reason: Phase 2 PostgreSQL/PostGIS integration and GitHub CI validation pending.
```
