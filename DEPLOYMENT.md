# Exécution et déploiement préparé

Aucun déploiement automatique n'est réalisé. Cible : service Node.js 24 avec connexion PostgreSQL 17/PostGIS 3.5, derrière HTTPS. Le serveur sert l'API et `dist/web` sur la même origine. Un hébergement de fichiers statiques seul ne suffit pas.

## Démonstration sans base ni API publique

```bash
npm ci
npm run demo:web
```

Ouvrir `http://localhost:4173` sur votre ordinateur. Rechercher « Interdit », « Conditionnel », « Autorisé », « Inconnu », « Erreur » ou « Paris ». Ces données sont fictives, seuls les services métier sont réels. Le mode démo est explicitement activé ; `npm start` ne bascule jamais automatiquement dessus. Une éventuelle variable APP_ORIGIN dans `.env` doit être `http://localhost:4173` pour ce mode.

## Service avec base réelle

Copier `.env.example` en `.env`, renseigner DATABASE_URL et les paramètres serveur. Installer/migrer la base sur un environnement qui la possède déjà ; ne pas installer Docker/PostgreSQL dans Work.

```bash
npm ci
npm run db:wait
npm run db:check
npm run db:migrate
npm run build
npm start
```

Ouvrir `http://localhost:3000`. Pour le développement avec rechargement, `npm run dev` expose le frontend :4173 et proxy l'API :4174 ; régler APP_ORIGIN=http://localhost:4173. Le lanceur charge `.env` et transmet les arguments Vite.

| Configuration | Emplacement | Utilité |
|---|---|---|
| DATABASE_URL | Serveur uniquement, secret | Connexion à PostGIS |
| PORT | Serveur, défaut 3000 | Port HTTP de production |
| APP_ORIGIN | Serveur | Origine publique exacte, par ex. https://votre-domaine.fr |
| GEOCODING_* | Serveur | Provider existant, timeout/cache/débit ; défauts dans .env.example |
| DIALOG_* | Serveur / synchronisations | Import et fraîcheur existants |
| PARKING_REALTIME_MAX_AGE | Serveur | Fraîcheur maximale existante |
| POSTGRES_PASSWORD | Docker de développement/CI | Mot de passe cohérent avec DATABASE_URL |

Aucune variable VITE_* ou clé nécessaire côté navigateur. Ne jamais committer `.env`. Géocodage public sans clé ; configuration temps réel seulement après vérification du contrat existant. Les commandes de synchronisation restent celles de LYON.md et DIALOG.md, à exécuter séparément du serveur HTTP. Ne jamais charger les fixtures de tests en production.

La mise en production nécessite un périmètre Lyon officiel importé, les synchronisations, la fraîcheur des sources et des emplacements certifiés pour les autorisations locales. Le rapprochement des axes seul ne les certifie pas. Une CI verte vérifie le logiciel sur fixtures, pas la complétude des données réelles. Compléter identité, contact, hébergeur et mentions légales avant ouverture publique.

Au frontal : HTTPS obligatoire pour GPS mobile, même origine API/static, compression gzip/Brotli, timeouts cohérents, pas de journalisation des query strings de géocodage ni des corps POST/GPS. Vérifier aussi la conservation des IP dans les logs de l'hébergeur. Le rate limiter applicatif est en mémoire par instance et n'accorde aucune confiance implicite aux forwarded headers.

Liveness : GET /api/health. Readiness : GET /api/ready (SELECT 1), ne certifie ni PostGIS ni la couverture : ceux-ci sont vérifiés séparément par `validate:db` et l'audit de données.

## Validation GitHub Actions, simplement

1. Décompresser le ZIP puis copier son contenu dans le dossier local du dépôt existant `john07-max/jepeuxstationner`. Conserver votre dossier Git ; ne copier ni `.env` ni node_modules.
2. Dans GitHub Desktop, choisir ce dépôt et vérifier les modifications.
3. Saisir « PHASE 4 API et interface mobile », cliquer Commit, puis Push origin.
4. Ouvrir le dépôt sur GitHub, onglet Actions, workflow « CI - PostGIS Lyon API Web ».
5. Attendre la fin. Pour relancer : Run workflow puis Run workflow.
6. Tous les contrôles doivent être verts, notamment intégrations, EXPLAIN, build et E2E. Un build vert seul ne suffit pas.
7. Renvoyer l'URL du run, le nombre de tests et l'archive `postgis-validation-…` disponible en bas du run. Elle contient logs SQL, intégration et mesure `api.offline.performance`, build, E2E, traces/rapport et captures responsive si les tests arrivent jusque-là.

Commandes équivalentes : `npm run validate` (sans base), `npm run validate:db` (vraie base requise), puis `npm run build`, `npx playwright install --with-deps chromium` et `npm run test:e2e` dans l'environnement de test. Aucun succès de substitution si PostgreSQL ou Chromium est absent.
