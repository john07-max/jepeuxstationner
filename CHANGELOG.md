# Correctif ciblé PHASE 3 — intégrations Lyon

- Corrige deux fixtures XML : dates actives/futures cohérentes avant le parsing, sans réactivation artificielle de règles expirées.
- Sépare ALLOWED de PAID/FREE ; une interdiction spécifique continue de prévaloir sur la permission générale.
- Expose mustLeaveBefore dans le DTO et vérifie la conservation des deux échéances.
- Renforce les préconditions de sélection PostGIS des 58 intégrations existantes.
- Ajoute 8 unités de régression : total 257 réussies localement.
- Conserve le seuil 500ms ; journal et plan disponibles avant une éventuelle assertion de performance.
- Validation runtime GitHub en attente ; aucune modification du parseur, de l'idempotence ou des migrations.

---

# PHASE 3 — 2026-09-06

- Audit officiel Lyon, extraction contrôlée/versionnée de 1 142 voies et captures WFS réelles.
- Rapprochement axes 1 103/1 142 ; aucune place de production certifiée.
- Domaine couverture/véhicule/tarifs/parkings et service applicatif.
- Calendrier France, règles visiteurs UNO, tarification progressive séparée.
- Migration 004, imports locaux idempotents, proximité PostGIS et observations séparées.
- Priorité générique limitée des interdictions spécifiques sur permissions générales ; DiaLog conservé.
- 54 nouveaux tests unitaires, 17 intégrations PostgreSQL préparées et 3 contrôles live Lyon.
- CI principale sans dépendance aux endpoints métier ; audit Lyon manuel distinct.
- Hors réseau : 249 tests verts. PostGIS non exécuté dans Work ; temps réel live HTTP 401. Pas de PHASE 4.

---

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

## PHASE 2 — 2026-09-05

Ajout du flux officiel DiaLog DATEX 3, parser SAX sécurisé, normalisation des interdictions, stockage PostGIS transactionnel idempotent, dry-run réel et adaptateur database → moteur. Contrat de restrictions informatives partielles et alias allowedUntil. Fixtures, tests offline, intégration SQL réelle préparée, workflow live séparé, métriques et documentation DIALOG.md. Phase 1 conservée. Validation PostGIS de cette révision en attente ; PHASE 3 non commencée.

## PHASE 4 — API et interface mobile, validation CI en attente

Ajout de apps/web, API check/autocomplete/reverse/health/ready, interface React mobile, GPS volontaire, durées Paris, quatre états et tarification séparée, alternatives, carte locale différée et pages d'information. Tests API/temps/E2E et intégration HTTP/PostGIS ; CI enrichie. Architecture métier et migrations précédentes conservées. Aucun déploiement ni PHASE 5.

## PHASE 4 — correction des deux assertions E2E

Locator autocomplete limité aux adresses, fixture dédiée déterministe, coordonnées exactes et durée contrôlées. Test carte fonctionnel avant/après clic. Aucun code produit changé ; 21 scénarios conservés. 296 tests locaux passent ; nouvelle CI en attente.

## PHASE 4.5 — Préparation Railway

Dockerfile Node 24 et exclusions de build ; guide Railway via interface avec base PostGIS persistante, migrations et synchronisation séparée. Bootstrap administratif Lyon nécessaire à une base neuve, sans fausses places ni permissions. Trois tests locaux et une intégration de contour ; CI de construction/smoke du conteneur ajoutée. Aucun déploiement, changement métier ou PHASE 5.
