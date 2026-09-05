# Matrice de validation PHASE 0.5

Tous les cas SQL et DB ci-dessous sont PRÉPARÉS et NON ENCORE EXÉCUTÉS. Les tests locaux sont distingués dans TEST_RESULTS.md.

| Exigence | Preuve prévue |
| --- | --- |
| PostGIS disponible | db:check : pg_extension, PostGIS_Version(), version PostgreSQL |
| Point dans/hors Polygon | tests/geospatial.sql |
| Bordure ST_Covers | geospatial.sql et intégration boundary |
| MultiPolygon | geospatial.sql et intégration sur les deux composantes |
| Chevauchement | geospatial.sql compte 2 ; intégration refuse la sélection arbitraire |
| EPSG:4326 | geospatial.sql vérifie le SRID stocké et rejette 3857 |
| Longitude/latitude | points asymétriques 4.005/44.005 ; inversion sans correspondance |
| Géométrie invalide | insertion d'un polygone croisé rejetée par CHECK |
| Active/future/expirée | temporal.sql et filtrage réel de load-rules.sql dans l'intégration |
| Permanente | fin SQL non bornée, projection dans fenêtre finie, ALLOWED |
| Changements successifs | trois périodes successives, première échéance conservée |
| Donnée périmée | source stale et couverture stale conservées puis UNKNOWN |
| ALLOWED | intégration explicit allowed et permanent |
| CONDITIONAL | scénario B et condition explicite Permis fictif requis |
| FORBIDDEN | scénario A |
| UNKNOWN | scénario C, conflits, absence temporelle, données périmées |
| Deux sources officielles contradictoires | ORDER autorise / SIGNAGE interdit => UNKNOWN |
| Officielle contre secondaire | autorisation officielle prévaut sur interdiction secondaire |
| Index spatial | GiST présent, fixture 40 000 zones, requête réelle et EXPLAIN avec buffers |

## Chaîne d'intégration

Fixture SQL insérée → PostgreSQL/PostGIS → resolve-zone.sql via ST_Covers → load-coverage.sql et load-rules.sql → RuleSnapshot contenant ParkingRule[] → ParkingDecisionEngine → ParkingDecision.

19 tests d'intégration sont définis dans tests/integration/database-engine.test.ts. Aucune simulation de PostgreSQL. Absence de DATABASE_URL => échec explicite, pas skip. Les 23 assertions SQL prévues sont réparties entre schema.sql (4), geospatial.sql (9) et temporal.sql (10). Le contrôle de disponibilité et la mesure EXPLAIN sont des commandes séparées.

Le schéma en vigueur est 001 + 002 ; la seconde migration est indispensable à la fixture permanente. Le runner de migration est rejoué en CI pour vérifier qu'il ne réapplique pas les versions existantes.

Pour le scénario B, le début du séjour coïncide avec l'horloge d'évaluation (2026-09-05T12:00:00Z), l'autorisation finit à 13:00 et l'interdiction commence à 13:00 jusqu'à 14:00. La sortie attendue est CONDITIONAL avec mustLeaveBefore=13:00Z, pas une autorisation de rester jusqu'à 14:00.
