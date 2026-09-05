# Changelog

## 0.0.1 — 2026-09-05

Création du monorepo et des modèles immuables, interface DataSourceAdapter, moteur versionné avec décisions temporelles et traçabilité, orchestration avec timeout, fournisseur fictif, démonstration CLI, migration PostGIS et tests SQL. Ajout de tests métier, configuration CI, documentation technique/confidentialité/SEO/roadmap.

Correction lors de validation : rejet explicite des dates calendaires invalides et de 24:00 pour empêcher la normalisation silencieuse de Date.parse. Aucun fournisseur réel connecté.


## PHASE 0.5 — moteur 0.0.2 — 2026-09-05

Architecture conservée. Ajout du runner SQL, migration 002 pour les règles sans fin déclarée, pont PostgreSQL de validation, fixtures et assertions géospatiales/temporelles, tests d'intégration non mockés, mesure EXPLAIN et workflow GitHub à 18 étapes avec logs téléchargeables. Scripts validate, validate:db, reset protégé et contrôle explicite PostGIS.

Correction demandée du scénario B : CONDITIONAL et échéance mustLeaveBefore pour une interdiction future ; segments et sources préservés. Mise à jour de la documentation et procédure GitHub pour débutant.

Pendant la validation locale, le test lançant un sous-processus node --test héritait du contexte du test parent ; suppression de NODE_TEST_CONTEXT dans ce seul sous-processus pour vérifier réellement son échec sans DATABASE_URL. Aucun serveur PostgreSQL/PostGIS exécuté dans Work.


## PHASE 1 — 2026-09-05

Ajout de GeocodingProvider, types normalisés, coordonnées et erreurs typées ; adapter Géoplateforme search/autocomplete/reverse ; cache mémoire TTL/LRU ; transport unique avec timeout, retry borné et cooldown partagé pour 429 ; debounce annulable ; démonstration CLI ; tests hors réseau et suite live manuelle.

Architecture stationnement, moteur 0.0.2, migrations et tests DB conservés. Aucune dépendance npm supplémentaire. Documentation fournisseur, confidentialité et commandes ajoutée. Tests live exécutés réellement avec succès partiel, timeouts conservés dans les résultats. La PHASE 2 n'est pas commencée.
