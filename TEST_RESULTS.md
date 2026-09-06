# Résultats PHASE 4 — 6 septembre 2026

La CI des PHASES 0–3 est annoncée verte par l'utilisateur dans le cahier des charges PHASE 4. Aucun run GitHub PHASE 4 n'a été lancé ou observé ici. Historique conservé dans docs/validation/PHASE_3_RESULTS_ARCHIVE.md ; il ne décrit pas le statut actuel.

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK

| Commande / contrôle | Résultat réel |
|---|---|
| npm ci | Réussi, 91 paquets installés |
| npm run typecheck | Réussi : cœur, frontend et tests E2E en TypeScript strict |
| npm test | **296 tests, 296 réussis, 0 échec, 0 ignoré** |
| npm run build | Réussi : API tsc et frontend Vite |
| npm run demo | Réussi, données fictives |
| npm run lyon:coverage -- --file data/lyon/roads.geojson | Réussi, données locales |
| Parcours manuel dans le navigateur supervisé | Adresse fictive Interdit sélectionnée, durée 4 h, NON + PAID + 3 parkings, capture enregistrée |

39 tests locaux ajoutés (30 API et 9 périodes Paris). Les 257 tests historiques sont conservés. Logs exacts : docs/validation/phase4-*.log. Un avertissement npm sur la configuration http-proxy de Work est non bloquant.

Build : JS initial **211,46 ko minifié / 67,32 ko gzip**, CSS initial 8,45 / 2,62 ko. Carte différée : JS 980,68 / 258,13 ko et CSS 82,86 / 10,71 ko ; GeoJSON local 1 530 309 octets (287 397 gzip calculé). Les valeurs gzip Vite et gzip Python peuvent varier légèrement selon le compresseur. Le gros module MapLibre conserve l'avertissement Vite ; il n'est pas chargé pour lire la réponse. Pas de mesure Lighthouse ou réseau mobile réelle revendiquée.

Capture réelle : docs/validation/phase4-forbidden.jpg. Rendu desktop inspecté : formulaire et résultat en deux colonnes, NON rouge lisible, paiement séparé, alternatives et avertissement fictif. Le clic carte a été effectué ; le rendu final WebGL et les six largeurs ne sont pas validés manuellement. Une capture pleine page a expiré ; la capture de viewport suivante a réussi.

### Commandes tentées, bloquées avant validation fonctionnelle

- `npm run test:integration` : échec de chargement des trois fichiers, DATABASE_URL absente. **Aucune intégration PostgreSQL exécutée.**
- `npm run test:db`, `db:check`, `db:explain` : échec explicite DATABASE_URL requise. **Aucun SQL/PostGIS/EXPLAIN exécuté.**
- `npx playwright install chromium` : téléchargement expiré depuis cdn.playwright.dev ; aucune installation système tentée.
- `npm run test:e2e` : **21 échecs de lancement**, executable Chromium absent ; les assertions des scénarios n'ont pas été exécutées. Le contrôle manuel ci-dessus ne remplace pas cette suite.

## TESTS PRÉPARÉS POUR GITHUB ACTIONS MAIS NON ENCORE EXÉCUTÉS

- PostgreSQL 17 et PostGIS 3.5, connexion réelle et extension/version.
- Migrations et rejeu sans effet ; tests SQL géospatiaux/temporels inchangés.
- **59 intégrations** : 58 historiques et une nouvelle HTTP → service → PostGIS → moteur avec NON + PAID + 3 parkings.
- Mesure `api.offline.performance` : seuil <500 ms, fixtures exclues du chronométrage. **Temps réel DB après ajout API non mesuré dans Work.**
- EXPLAIN ANALYZE BUFFERS non forcé, index spatiaux historiques.
- **21 scénarios Playwright** : quatre décisions, deadline, erreurs, adresse/clavier/GPS, carte/fallback, pages et six largeurs.
- Nouvelle CI complète avec build web et E2E.

Inventaire JavaScript/TypeScript attendu : **376 tests = 296 locaux + 59 intégrations + 21 E2E**, sans compter les assertions SQL. **61 tests ajoutés** à la PHASE 4 : 39 locaux + 1 intégration + 21 E2E. Ce total est un inventaire, pas un total de réussites constatées.

```text
READY FOR PHASE 5: NO
Reason: Phase 4 GitHub Actions runtime validation pending; PostgreSQL/PostGIS/API performance and automated browser E2E not validated in Work.
```

Autres prérequis d'ouverture publique : couverture réelle certifiée, fraîcheur et contrat temps réel, identité/contact/hébergeur complétés. Aucun faux succès de base ni déploiement automatique.
