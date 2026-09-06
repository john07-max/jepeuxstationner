# Déployer JePeuxStationner sur Railway

PHASE 4.5, préproduction uniquement. La PHASE 4 et sa CI sont annoncées vertes par l'utilisateur. Rien n'a été créé dans votre compte et aucune application n'a été déployée par Work. Vous allez effectuer les clics ci-dessous. Aucun Docker/PostgreSQL ni terminal nécessaire sur votre PC.

## Ce qui sera créé

Trois services dans **un même projet Railway** :

- **JePeuxStationner** : site et API publics, même origine HTTPS.
- **PostGIS** : PostgreSQL 17 / PostGIS 3.5, réseau privé et volume persistant.
- **Sync-Lyon** : tâche de synchronisation terminant après chaque exécution, sans domaine public.

Le Dockerfile se trouve à la racine et garde tout le monorepo. Railway le détecte automatiquement ; pas de Nixpacks ni de railway.json supplémentaire. Les réglages ci-dessous sont conservés dans votre projet Railway. [Documentation des services](https://docs.railway.com/services).

## 1 — Copier les fichiers et ouvrir Railway

1. Copier le dossier du ZIP dans votre dossier GitHub Desktop habituel. Commit puis **Push origin**. Attendre la CI complète, y compris les nouvelles étapes « Build Railway staging image » et « Smoke test production container ».
2. Ouvrir [Railway](https://railway.com/), créer votre compte avec GitHub et autoriser l'accès à `john07-max/jepeuxstationner`. Aucun mot de passe de base ne doit être envoyé à GitHub.
3. Dans le tableau de bord, cliquer **New Project**, puis **GitHub repo**, sélectionner **john07-max/jepeuxstationner**, puis **Add variables** pour préparer les réglages avant de lancer le site. Si le dépôt n'est pas proposé, accorder à l'application Railway l'accès à ce dépôt dans GitHub.
4. Nommer le service **JePeuxStationner**. Les libellés sont ceux de la documentation Railway consultée le 6 septembre 2026 ; l'interface peut varier légèrement. [Démarrage GitHub officiel](https://docs.railway.com/quick-start).

## 2 — Ajouter la vraie base PostGIS

1. Revenir au canevas du projet. Cliquer **New** → option **Docker Image** et saisir exactement `postgis/postgis:17-3.5`. C'est la même famille d'image que notre CI, avec PostgreSQL 17. **Ne pas choisir une base PostgreSQL standard sans PostGIS** et ne pas remplacer l'image d'une base déjà remplie d'une autre version majeure. [Image du projet PostGIS](https://github.com/postgis/docker-postgis).
2. Nommer ce service **PostGIS** (orthographe importante pour les références ci-dessous).
3. Cliquer sur **PostGIS → Variables → New Variable** et ajouter les variables de la table « Base » plus bas. Créer le mot de passe avec votre gestionnaire de mots de passe : au moins 32 caractères aléatoires, lettres et chiffres, puis le coller uniquement dans POSTGRES_PASSWORD. Aucun exemple de secret n'est livré.
4. Sur le canevas, clic droit → créer un **Volume**, l'attacher à **PostGIS**, régler son **Mount Path** sur `/var/lib/postgresql/data`. Le volume est indispensable pour conserver les données. Régler PGDATA sur `/var/lib/postgresql/data/pgdata` évite d'initialiser PostgreSQL à la racine du volume. [Volumes Railway](https://docs.railway.com/volumes).
5. Garder la commande de démarrage fournie par l'image. Aucun health check HTTP sur cette base, aucun domaine public, aucun TCP Proxy requis. Choisir la même région pour la base, le site et la synchronisation.
6. Appliquer les changements via **Deploy**. Dans **Deployments**, ouvrir les logs : attendre « database system is ready to accept connections ». Une erreur de mot de passe ou de volume doit être corrigée avant de poursuivre. Ne pas supprimer le volume pour résoudre un simple échec applicatif.

## 3 — Connecter le site à la base

Dans **JePeuxStationner → Variables → New Variable** :

```text
DATABASE_URL=${{PostGIS.DATABASE_URL}}
APP_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
```

Les `${{...}}` sont des références Railway à conserver telles quelles. Ne pas les remplacer par un mot de passe dans Git. DATABASE_URL est transmise uniquement au serveur. Après création du domaine, vérifier qu'APP_ORIGIN est bien l'URL HTTPS exacte sans barre finale ; on peut aussi coller manuellement cette URL dans APP_ORIGIN. [Variables et références](https://docs.railway.com/variables/reference).

## 4 — Régler le build, les migrations et le health check

Ouvrir **JePeuxStationner → Settings** :

| Réglage | Valeur |
|---|---|
| Root Directory | `/` : dossier contenant package.json, apps, packages et Dockerfile |
| Dockerfile | Détection automatique du Dockerfile racine |
| Install | Dockerfile : `npm ci --include=dev` |
| Build | Dockerfile : `npm run build` ; laisser le champ Build Command personnalisé vide |
| Start Command | `npm start` (également le CMD du Dockerfile) |
| Pre-Deploy Command | `npm run db:migrate && npm run db:check` |
| Healthcheck Path | `/api/health` |
| Healthcheck Timeout | 300 secondes |
| Replicas | 1 pour cette préproduction |

**Ne pas mettre `/apps/web` en root directory** : le serveur, les workspaces, les scripts SQL et les données en dépendent. Si votre dépôt GitHub contient par erreur un dossier parent `jepeuxstationner`, le root doit viser ce dossier ; le ZIP est prévu pour être copié dans votre dépôt existant, avec package.json directement à sa racine.

La précommande s'exécute dans le réseau privé avec DATABASE_URL et bloque le déploiement si elle échoue. `001_initial.sql` contient `CREATE EXTENSION IF NOT EXISTS postgis;`. Les migrations enregistrent leurs versions et utilisent un verrou ; elles ne recréent pas les données à chaque déploiement. **Aucun db:reset, DROP, TRUNCATE ou fixture de test dans la procédure.** Le contrôle db:check vérifie l'extension et appelle PostGIS_Version(). [Précommandes Railway](https://docs.railway.com/deployments/pre-deploy-command).

L'application écoute déjà sur `0.0.0.0` et le `PORT` fourni. Ne pas imposer localhost comme interface d'écoute. Le health check n'est qu'un contrôle de démarrage ; `/api/ready` vérifie séparément la connexion SQL et aucune de ces routes ne certifie la couverture métier. [Health checks Railway](https://docs.railway.com/deployments/healthchecks).

## 5 — Obtenir l'URL et déployer

1. Dans **Settings → Networking → Public Networking**, cliquer **Generate Domain**. Si le bouton n'est disponible qu'après un premier déploiement, lancer celui-ci puis générer le domaine immédiatement après.
2. Railway fournit une URL HTTPS ; l'origine publique n'est donc pas localhost. Si un port cible est demandé, utiliser celui de PORT, pas un numéro deviné.
3. Vérifier APP_ORIGIN avec cette URL, puis appliquer les variables/changements via **Deploy**. Un premier déploiement sans domaine peut suffire au health check ; ne tester les requêtes de stationnement qu'après configuration de l'origine correcte.
4. Dans **Deployments**, contrôler successivement le build, les migrations, PostGIS_Version et le démarrage. Le site devient actif lorsque son health check répond.
5. Ouvrir `https://VOTRE-DOMAINE/api/health` : attendre `{"status":"ok"}`. Ouvrir `/api/ready` : attendre également `{"status":"ok"}`. La racine affiche le formulaire.

Railway gère le domaine et le certificat HTTPS. [Créer un domaine public](https://docs.railway.com/networking/public-networking).

## 6 — Charger les données entièrement dans Railway

Les migrations seules ne remplissent pas le site. Pour éviter un terminal local et séparer le serveur des téléchargements, ajouter un service de tâche :

1. Sur le canevas : **New → GitHub repo** (ou service vide puis **Settings → Connect Repo**) → choisir le même dépôt. Nommer le service **Sync-Lyon**.
2. Dans **Variables**, ajouter `DATABASE_URL=${{PostGIS.DATABASE_URL}}`. Ne pas ajouter APP_ORIGIN, de domaine ou de volume à cette tâche.
3. Dans **Settings**, Root Directory `/`, même Dockerfile ; **Start Command** = `npm run staging:sync`. Pas de Pre-Deploy Command nécessaire ici, car la commande comprend migrations et contrôle PostGIS. **Healthcheck Path vide**. **Restart Policy = Never** : une tâche terminée ne doit pas redémarrer en boucle.
4. Pour le premier remplissage : laisser **Cron Schedule vide**, puis **Deploy**. Le processus effectue les commandes ci-dessous dans l'ordre et termine. Un état terminé n'est pas une panne : vérifier le code de sortie et les logs. Le marqueur final `STAGING_SYNC_COMPLETE` atteste que toutes les commandes ont réussi.
5. Après ce premier succès, régler **Settings → Cron Schedule** sur `0 */6 * * *` : toutes les six heures UTC. Conserver Start Command et Restart Policy. Cette marge évite d'attendre la limite de fraîcheur DiaLog de 24 h. Une erreur réseau doit rester visible, pas être transformée en succès.
6. Pour relancer sans attendre, utiliser l'action **Redeploy** du service Sync-Lyon pour une exécution immédiate ; si l'interface du service cron ne la propose pas, retirer temporairement Cron Schedule, déployer une fois, puis remettre l'expression. Ne pas lancer plusieurs imports manuels simultanément.

Les tâches Railway exécutent la commande de démarrage et doivent terminer ; une exécution encore active empêche le cron suivant. [Tâches planifiées](https://docs.railway.com/cron-jobs).

La commande groupée est :

```bash
npm run staging:sync
```

Elle exécute :

```bash
npm run db:migrate
npm run db:check
npm run sync:lyon:boundary
npm run sync:lyon:parking-rules
npm run sync:lyon:facilities
npm run sync:dialog
```

- **Boundary** : ajout nécessaire pour une base neuve. Charge le contour officiel de Lyon, code INSEE 69123, dans cities. Sans ce contour, l'API retourne 503. Ne crée aucune place ni permission de stationner. Source : [API Découpage administratif](https://geo.api.gouv.fr/decoupage-administratif/communes), requête `https://geo.api.gouv.fr/communes/69123?format=geojson&geometry=contour`.
- **Parking-rules** : reprend le rapprochement des voies et les règles locales existantes.
- **Facilities** : reprend les parkings publics statiques.
- **DiaLog** : importe les restrictions réelles via le pipeline existant.

Les synchronisations conservent leurs protections et peuvent désactiver logiquement les éléments réellement absents du flux complet ; elles ne réinitialisent pas la base. Un échec arrête la chaîne, mais les synchronisations précédentes déjà réussies restent enregistrées. Relancer est prévu par leur idempotence. Ne pas employer les fixtures tests comme données de préproduction réelle.

Le temps réel est **optionnel et non activé par défaut** : la connexion/mapping précédent n'est pas suffisamment vérifié. La commande existante est `npm run sync:lyon:facilities -- --realtime`, uniquement après validation de LYON_REALTIME_MAPPING et de l'accès au flux. Une tâche toutes les six heures ne suffit pas pour maintenir une observation fraîche de 180 secondes ; ne pas présenter ces observations comme actuelles sans rafraîchissement adapté. Aucun secret de temps réel inventé.

## 7 — Tester depuis votre téléphone

1. Attendre la fin réussie de Sync-Lyon, puis ouvrir la même URL HTTPS sur votre téléphone, même en 4G/5G. Votre PC peut être éteint.
2. Chercher une adresse à Lyon, sélectionner une suggestion, choisir 2 h et vérifier. Essayer aussi « Utiliser ma position » uniquement si vous souhaitez partager votre position.
3. Hors Lyon : message de périmètre. À Lyon sans emplacement certifié : **INFORMATION INSUFFISANTE** est attendu, avec les parkings si disponibles. Ce n'est pas une panne Railway.
4. **Limite réelle du dépôt : les synchronisations ne créent pas d'emplacements de voirie certifiés.** Le service existant exige une couverture vérifiée avant d'évaluer les règles locales/DiaLog à cette position. L'inventaire d'axes n'en apporte pas la preuve. Vous pouvez tester le parcours, l'API, le GPS et les alternatives, mais vous ne devez pas attendre des OUI/NON documentés partout. La préproduction n'ajoute pas de fausses preuves pour obtenir ces états.
5. Prix exact et disponibilité peuvent rester inconnus. L'audit Lyon garde ses limites ; la revue réglementaire existante expire le **6 octobre 2026**, elle ne doit pas être prolongée sans nouvelle vérification.
6. Garder cette URL comme préproduction de test. Compléter les mentions légales avant diffusion publique large, contrôler les coûts/ressources Railway et activer les sauvegardes du volume. Aucun compte utilisateur, publicité ou PHASE 5 ajouté.

## Variables Railway exactes

### Obligatoires — site et synchronisation

| Service | Variable | Valeur |
|---|---|---|
| JePeuxStationner | DATABASE_URL | `${{PostGIS.DATABASE_URL}}` |
| JePeuxStationner | APP_ORIGIN | `https://${{RAILWAY_PUBLIC_DOMAIN}}`, ou l'URL HTTPS exacte sans barre finale |
| Sync-Lyon | DATABASE_URL | `${{PostGIS.DATABASE_URL}}` |

### Obligatoires — base PostGIS créée depuis l'image

| Variable | Valeur dans le service PostGIS |
|---|---|
| POSTGRES_USER | `parking` |
| POSTGRES_DB | `parking` |
| POSTGRES_PASSWORD | Mot de passe aléatoire que vous générez dans Railway/votre gestionnaire, jamais dans Git |
| PGDATA | `/var/lib/postgresql/data/pgdata` |
| DATABASE_URL | `postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{POSTGRES_DB}}` |

Le mot de passe alphanumérique évite les problèmes d'encodage dans l'URL. L'image Docker générique ne crée pas à votre place une variable Railway DATABASE_URL : la définir ici une fois permet ensuite la référence entre services. Ne pas activer POSTGRES_HOST_AUTH_METHOD=trust.

### Optionnelles

Les défauts de `.env.example` sont conservés. Pas besoin de les recopier pour commencer : `GEOCODING_BASE_URL`, `GEOCODING_TIMEOUT_MS`, `GEOCODING_CACHE_TTL_MS`, `GEOCODING_EMPTY_CACHE_TTL_MS`, `GEOCODING_CACHE_MAX_ENTRIES`, `GEOCODING_RATE_LIMIT`, `GEOCODING_MAX_QUEUE_WAIT_MS`, `GEOCODING_MAX_RETRIES`, `GEOCODING_RETRY_BASE_MS`, `GEOCODING_DEFAULT_RETRY_AFTER_MS`, `GEOCODING_MIN_AUTOCOMPLETE_CHARS`, `GEOCODING_DEBOUNCE_MS`, `GEOCODING_MAX_RESULTS`, `GEOCODING_DEFAULT_RESULTS`, `DIALOG_TIMEOUT_MS`, `DIALOG_FRESHNESS_MS`, `DIALOG_MAX_BYTES`, `DIALOG_SPATIAL_TOLERANCE_METERS`, `PARKING_REALTIME_MAX_AGE` et `LYON_REALTIME_MAPPING` (ce dernier seulement après audit). NODE_ENV=production est fixé dans l'image. Aucun VITE_* ni secret navigateur. Ne pas activer JPS_PREVIEW_DEMO ni ALLOW_DB_RESET sur Railway.

### Générées automatiquement par Railway

`PORT` pour le service HTTP, `RAILWAY_PRIVATE_DOMAIN` pour chaque service et `RAILWAY_PUBLIC_DOMAIN` après ajout d'un domaine. Ne pas copier le PORT du service web dans PostgreSQL : l'image PostGIS utilise son port SQL 5432. POSTGRES_PASSWORD n'est pas supposé généré automatiquement par une image Docker générique ; DATABASE_URL applicative est une référence explicitement configurée.

## Si une étape échoue

- Build : envoyer les logs Build, sans variables secrètes.
- Migration/extension : vérifier l'image 17-3.5, la base ciblée, le volume et DATABASE_URL ; ne jamais supprimer la base automatiquement.
- 403 après recherche : APP_ORIGIN ne correspond pas exactement au domaine HTTPS utilisé.
- 503 au check mais health vert : vérifier `/api/ready`, le contour et les logs Sync-Lyon. Health ne certifie pas les données.
- UNKNOWN : vérifier la couverture/fraîcheur ; ne pas transformer en autorisation par configuration.
- Import arrêté : l'étape fautive apparaît dans les logs ; les téléchargements officiels peuvent échouer. Relancer après diagnostic, pas avec des fixtures inventées.
- Limiteur : le serveur utilise l'adresse du socket ; derrière le proxy la limite peut être partagée. Conserver une seule instance pour les essais et espacer les requêtes. Les logs du frontal ne doivent pas conserver les adresses/GPS des queries ou corps POST.

Renvoyer l'URL du site, le résultat de `/api/health` et `/api/ready`, les logs de migration et de Sync-Lyon, et l'URL de la CI. Ne jamais envoyer DATABASE_URL ou POSTGRES_PASSWORD.

---

# Référence locale et historique PHASE 4

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
