# Validation PHASE 4.5 — préparation Railway

La PHASE 4 et toute sa CI sont confirmées vertes par l'utilisateur. Aucun déploiement Railway n'a été effectué. L'historique antérieur ci-dessous n'est pas le statut actuel.

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK

- npm ci : réussi, 91 paquets installés.
- npm run build : réussi, API et frontend de production ; avertissement de taille MapLibre inchangé.
- npm run typecheck : réussi.
- npm test : **299 tests réussis, 0 échec, 0 ignoré** (296 historiques + 3 validations de contour).
- npm run demo et lyon:coverage hors réseau : réussis.
- Vrai démarrage `dist/apps/web/server/start.js` avec PORT=4191 : health HTTP 200 et page de production HTTP 200. DATABASE_URL pointait volontairement sur un port indisponible ; aucun test PostgreSQL n'est déduit de ce contrôle.

Preuves : docs/validation/phase45-*. Les sources officielles n'ont pas été synchronisées dans une base par Work. Aucun service Railway, Docker ou PostgreSQL n'a été lancé ici.

## VALIDATIONS PRÉPARÉES MAIS NON EXÉCUTÉES ICI

- Image Docker Node 24 et smoke du conteneur : étapes CI ajoutées, non exécutées dans Work.
- PostgreSQL/PostGIS, migrations et 60 intégrations dont le nouveau bootstrap de contour : CI à rejouer après cette modification.
- 21 E2E inchangés : précédente CI verte selon l'utilisateur ; non réexécutés ici faute de Chromium disponible.
- Téléchargements et imports officiels : à exécuter par Sync-Lyon dans Railway.
- Domaine public, variables privées, volume et health Railway : à configurer par l'utilisateur.

Inventaire JS/TS : **380 = 299 locaux + 60 intégrations + 21 E2E**, plus assertions SQL. Le succès local du build npm n'est pas une preuve d'exécution du conteneur ou de déploiement Railway.

Dépôt préparé pour déploiement de préproduction ; exécution et recette Railway en attente. La PHASE 5 n'est pas commencée.

---

# Historique

# Dernière validation — correctif E2E PHASE 4

Le run précédent est annoncé par l'utilisateur : **19/21 E2E réussis, 2 échoués**, autres étapes vertes. Deux bugs de test corrigés, aucun fichier produit modifié. Voir [PHASE4_E2E_FIX.md](PHASE4_E2E_FIX.md).

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK — correctif

TypeScript réussi ; **296/296 tests locaux réussis** ; build production réussi ; demo et rapprochement Lyon hors réseau réussis. Logs `docs/validation/phase4-e2e-fix-*`.

Commandes tentées mais bloquées : intégrations, test:db et validate:db faute de DATABASE_URL ; E2E faute de Chromium. Ces échecs de lancement ne constituent pas une exécution des assertions DB/navigateur. Aucune installation système PostgreSQL/Docker.

## TESTS PRÉPARÉS POUR GITHUB ACTIONS MAIS NON ENCORE EXÉCUTÉS — correctif

21 E2E dont les deux corrigés, 59 intégrations, PostgreSQL/PostGIS/migrations/SQL/EXPLAIN et CI complète à rejouer. Inventaire inchangé : 376 tests JS/TS plus assertions SQL. Aucun nouveau résultat GitHub du correctif disponible.

READY FOR PHASE 5: NO

Raison : CI complète après correction en attente.

---

Historique de livraison ci-dessous, conservé comme compte rendu antérieur.

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
