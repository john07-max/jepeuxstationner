# Correctif des deux tests E2E PHASE 4

## Diagnostic avant modification du produit

**Autocomplete : bug de test.** Le locator global `page.getByRole('option')` incluait les quatre options HTML du sélecteur d'énergie (inconnu, thermique, hybride rechargeable, électrique). Il pouvait donc compter 4 avant la réponse puis 5 avec une seule adresse. Le mock générique local retourne bien une adresse pour « Autorisé ». Il n'y avait aucune raison de limiter le produit à une suggestion.

Correction : fixture HTTP réservée à ce test, deux résultats fixes et ordonnés ; locator limité au listbox « Adresses proposées ». Vérification de 1 à 5 suggestions puis de leur contenu déterministe, ArrowDown avec aria-selected=true, Enter et confirmation du libellé. Les latitude ET longitude exactes envoyées sont comparées à celles de la suggestion sélectionnée. Durée deux heures = 7 200 000 ms. Moins de trois caractères : zéro requête après la fenêtre debounce. Aucun appel à une API externe.

**Carte : bug de test, aucun bug produit établi.** Le code utilise déjà React.lazy avec import dynamique. Le composant n'est monté que lorsque `map && selected` est vrai, après le bouton Afficher la carte. MapLibre et son CSS sont importés dans ce seul composant ; sa source GeoJSON est configurée dans l'effet de montage. Le build produit un chunk carte séparé ; index.html ne charge initialement que le JS/CSS principal.

Le GeoJSON est actuellement référencé par URL locale dans le produit ; MapLibre comporte un chargement GeoJSON dans son worker. Une assertion sur `page.on('request')` et un nom de fichier précis ne constitue pas une preuve fiable du rendu ou de son absence. L'explication exacte de l'événement absent dans le run distant nécessiterait sa trace ; les assertions canvas et quatre marqueurs avaient déjà réussi selon le rapport transmis.

Correction : région carte et canvas absents au démarrage et après résultat NON ; aucun marqueur avant clic ; après clic, région et canvas visibles, quatre marqueurs présents, résultat NON toujours visible. Aucune dépendance à un nom de chunk ou de GeoJSON dans ce test. Le test existant de panne du chunk, actuellement vert, est conservé tel quel.

## Périmètre et preuves

Aucun fichier produit dans apps/ ou packages/ modifié, vérifié octet par octet contre le ZIP PHASE 4 livré. Aucun changement de bundling, carte, API, fixture générique, moteur, base ou workflow. Seuls les deux tests concernés sont remplacés dans tests/e2e/parking.spec.ts ; les 19 autres restent inchangés.

Fichiers modifiés : tests/e2e/parking.spec.ts, DECISIONS.md, CHANGELOG.md, TEST_RESULTS.md. Ajout : ce rapport et les logs docs/validation/phase4-e2e-fix-*.

## Validation réelle dans Work

- npm run typecheck : réussi.
- npm test : **296/296 réussis**, 0 échec, 0 ignoré.
- npm run build : réussi, chunk MapLibre séparé ; avertissement de taille inchangé, non bloquant.
- npm run demo et rapprochement Lyon hors réseau : réussis.
- npm run test:integration : échec avant les tests DB, DATABASE_URL absente.
- npm run test:db et npm run validate:db : échec explicite, aucune validation PostgreSQL/PostGIS exécutée.
- npm run test:e2e : lancement tenté, Chromium absent ; aucune validation des scénarios corrigés annoncée. Pas de nouvelle tentative d'installation système PostgreSQL/Docker ni de contournement.

Inventaire inchangé : **376 tests JS/TS = 296 locaux + 59 intégrations + 21 E2E**, plus assertions SQL. Zéro test ajouté ou supprimé.

GitHub Actions : dernier résultat communiqué par l'utilisateur **19/21 E2E**, autres étapes vertes. Le correctif n'a pas encore été poussé/exécuté dans GitHub depuis Work. **21/21 n'est pas encore constaté.**

## Appliquer

Copier le contenu du dossier jepeuxstationner du ZIP correctif dans votre dossier existant, accepter le remplacement des fichiers, puis GitHub Desktop → Commit → Push origin. Ouvrir Actions et attendre le workflow complet. Renvoyer le lien du run et, si nécessaire, l'archive postgis-validation contenant e2e.log et le rapport Playwright. Aucune PHASE 5 commencée.

READY FOR PHASE 5: NO

Raison : nouvelle CI complète, notamment les deux scénarios corrigés, en attente d'exécution réussie.
