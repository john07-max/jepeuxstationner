# JePeuxStationner — PHASE 3 : pilote Lyon

Pilote Lyon : inventaire officiel des voies, couverture positive explicite, règles UNO sourcées, tarification séparée, parkings publics et service applicatif. L'architecture et le correctif d'idempotence DiaLog sont conservés. Voir [LYON.md](LYON.md), [LYON_AUDIT.md](LYON_AUDIT.md), [TEST_RESULTS.md](TEST_RESULTS.md) et [DELIVERY_PHASE_3.md](DELIVERY_PHASE_3.md).

**257 tests unitaires passent dans Work après le correctif des intégrations Lyon.** La CI PHASE 2 est confirmée verte par l'utilisateur. La CI PHASE 3 précédente a exécuté 58 intégrations : 54 réussies, 4 échouées. Le correctif reste à revalider sur GitHub. Voir [PHASE3_INTEGRATION_FIX.md](PHASE3_INTEGRATION_FIX.md). Les 96,58 % de rapprochement des axes ne certifient aucune place : **0 emplacement réel vérifié**. Le temps réel officiel renvoie HTTP 401 depuis Work. Ces limites empêchent encore une mise en service permettant d'autoriser du stationnement réel.

```text
READY FOR PHASE 4: NO
Reason: Phase 3 PostgreSQL/PostGIS CI pending; verified parking-space coverage absent; realtime access/schema unverified.
```

## Essayer le pilote hors réseau

```bash
npm ci
npm run validate
npm run lyon:coverage -- --file data/lyon/roads.geojson
```

Les commandes de synchronisation, le service check:parking et la configuration sont documentés dans LYON.md. Aucune interface web finale n'est ajoutée.

## Essayer le géocodage

Node.js 24 est requis. Dans le dossier du projet :

```bash
npm ci
npm run typecheck
npm test
npm run demo:geocode -- "10 rue de la Paix Paris"
npm run demo:geocode -- --autocomplete "12 rue vict"
npm run demo:geocode -- --reverse 48.8566 2.3522
```

Aucune clé API nécessaire. La CLI affiche adresse normalisée, latitude, longitude, code postal, commune, code INSEE et score lorsqu'ils sont disponibles. Elle échoue explicitement si le service dépasse le timeout. Les adresses ne sont pas stockées en base.

Pour les tests géocodage seuls : `npm run test:geocoding`. Pour cinq requêtes officielles contrôlées : `npm run test:geocoding:live` ; cette commande est volontairement indépendante des tests habituels. Les résultats réels sont dans TEST_RESULTS.md et le contrat complet dans GEOCODING.md.

## Mettre à jour le dépôt GitHub existant

Remplacer les fichiers de votre copie locale par ceux de cette livraison, en conservant le dossier `.git` et votre `.env`. Dans le dossier contenant package.json :

```bash
git add .
git commit -m "Add Phase 3 Lyon pilot"
git push
```

Avec **GitHub Desktop** : copier le contenu du dossier extrait dans votre dossier local existant (ne pas créer un deuxième dossier jepeuxstationner à l'intérieur), accepter le remplacement des fichiers, ouvrir ce dépôt dans Desktop, vérifier les changements, saisir un résumé, cliquer **Commit to main**, puis **Push origin**. Conserver votre dossier `.git` et votre `.env`.

Ouvrir **Actions** et attendre **CI - PostGIS geocoding DiaLog Lyon**. Le workflow applique les quatre migrations et exécute les 58 tests d'intégration définis, dont 17 nouveaux scénarios Lyon. Le workflow distinct **Lyon live audit (manual)** peut ensuite être lancé avec **Run workflow** ; son contrôle temps réel échouera tant que l'accès et le mapping n'ont pas été vérifiés. Renvoyer le lien d'exécution et les archives de logs. Les étapes sont détaillées dans DELIVERY_PHASE_3.md.

La configuration du géocodage est ajoutée à `.env.example`. Le cache de résultats dure 24 h (500 entrées maximum), les résultats vides 30 s, les erreurs ne sont pas cachées. Débit par défaut 5/s dans un processus ; plusieurs réplicas nécessiteront un budget commun. Voir GEOCODING.md pour les limites et toutes les variables.

# Historique et validation PostgreSQL/PostGIS

Les CI PHASES 0/0.5/1/2 sont confirmées vertes par l'utilisateur dans le brief PHASE 3. Les changements Lyon restent à revalider.

```text
PHASE 0/0.5: validated according to user's GitHub Actions confirmation.
Current revision: GitHub Actions revalidation pending.
```

## Architecture conservée

Monorepo npm workspaces, Node.js 24, TypeScript strict, PostgreSQL 17/PostGIS 3.5. Le moteur reste pur, sans dépendance SQL. `pg` et ses types servent à la validation et à la lecture des fixtures ; DiaLog est désormais connecté via une extension additive. Voir ARCHITECTURE.md et DECISIONS.md.

Les sources disponibles de la spécification sont les instructions du projet et les demandes PHASE 0/0.5. Aucune règle réelle n'est inventée. Une couverture absente, périmée ou un conflit officiel donnent UNKNOWN. Les périodes sont explicites et les décisions traçables. Aucune recherche personnelle n'est conservée.

## Validation locale sans base

Depuis le dossier contenant package.json :

```bash
npm ci
npm run typecheck
npm test
npm run demo
```

Après installation, `npm run validate` regroupe typecheck, tests et démo. Il ne teste PAS PostgreSQL. Les tests d'intégration DB sont compilés mais seuls les tests unitaires, mémoire et garde-fous sans connexion s'exécutent. La démo utilise une horloge fixe et un fournisseur en mémoire.

## Validation avec une base disponible

Ne pas installer Docker/PostgreSQL dans l'environnement Work actuel. Cette section sert uniquement à une autre machine déjà équipée, ou à GitHub Actions.

1. Copier `.env.example` en `.env` (PowerShell : `Copy-Item .env.example .env`).
2. Modifier le mot de passe aux DEUX endroits : POSTGRES_PASSWORD et DATABASE_URL. Un mot de passe inclus dans une URL doit être encodé si nécessaire.
3. Exécuter :

```bash
npm ci
npm run db:up
npm run validate:db
```

`db:up` utilise Docker Compose ici ET dans GitHub Actions, avec la même image `postgis/postgis:17-3.5`, reconnue par le projet PostGIS. Il attend le healthcheck. `db:wait` confirme ensuite une vraie connexion SQL authentifiée, pendant au maximum 60 secondes.

| Commande | Fonction |
| --- | --- |
| npm run db:up | Démarre la base Compose et attend le healthcheck |
| npm run db:wait | Attend une réponse réelle à SELECT 1 |
| npm run db:check | Exige pg_extension.postgis et PostGIS_Version() |
| npm run db:migrate | Applique les migrations manquantes dans l'ordre |
| npm run db:reset | Réinitialise uniquement les tables/types du projet sur une base locale jetable, avec garde-fou |
| npm run test:db | Exécute les assertions SQL/PostGIS réelles |
| npm run test:integration | Compile puis exécute les tests DB → moteur, sans mock |
| npm run db:explain | Génère 40 000 zones et EXPLAIN ANALYZE BUFFERS |
| npm run validate:db | wait → check → migrate → test:db → test:integration → explain |

Toute erreur de connexion, extension, migration ou assertion donne un code de sortie non nul. Aucun test DB n'est sauté pour donner un succès artificiel. `validate:db` ne démarre pas Docker lui-même : lancer `db:up` d'abord. Il ne remplace pas `validate` pour les tests unitaires.

Réinitialisation volontaire, uniquement sur la base locale jetable `/parking` : ajouter temporairement `ALLOW_DB_RESET=local-disposable` à `.env`, lancer `npm run db:reset`, puis retirer cette variable. Cette commande efface les tables du projet et rejoue les migrations ; elle ne supprime ni schéma public ni extension. Elle n'est pas utilisée par la CI. La CI détruit seulement son volume éphémère en fin de job.

## Variables d'environnement

| Variable | Local | GitHub Actions |
| --- | --- | --- |
| POSTGRES_PASSWORD | Mot de passe dans .env | Déjà défini dans ci.yml pour la base jetable |
| DATABASE_URL | URL de la même base, utilisateur parking, port 5432 | Déjà définie dans ci.yml, 127.0.0.1:5432/parking |
| ALLOW_DB_RESET | Facultative, seulement pour une remise à zéro volontaire | Absente |

Aucun secret GitHub, compte de base hébergée ou clé d'API n'est nécessaire pour cette CI. `.env` est ignoré par git. Les identifiants présents dans ci.yml sont uniquement ceux de la base de test créée pour ce job.

# Validation avec GitHub Actions

Aucune installation de PostgreSQL n'est nécessaire sur votre ordinateur pour cette procédure. Il faut un compte GitHub et Git sur votre ordinateur.

1. **Extraire l'archive.** Ouvrir le dossier `jepeuxstationner` : vous devez voir `package.json` et le dossier `.github`.
2. **Créer le dépôt.** Aller sur [Créer un dépôt GitHub](https://github.com/new), choisir un nom, par exemple `jepeuxstationner`, et de préférence « Private ». Ne pas cocher l'ajout d'un README, d'un .gitignore ou d'une licence. Cliquer « Create repository ».
3. **Copier l'adresse HTTPS** affichée par GitHub, du type `https://github.com/VOTRE-COMPTE/jepeuxstationner.git`.
4. **Ouvrir un terminal dans le dossier extrait.** Sur Windows, clic droit dans le dossier puis « Ouvrir dans le terminal ». Copier ces commandes une par une, en remplaçant l'URL de l'avant-dernière commande par celle copiée :

```bash
git init
git add .
git commit -m "Add Phase 2 DiaLog validation"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/jepeuxstationner.git
git push -u origin main
```

Si Git demande votre identité, définir `git config user.name "Votre nom"` et `git config user.email "Votre email GitHub"`, puis reprendre à `git commit`. S'authentifier via le navigateur si Git le propose. Ne pas coller de mot de passe ou de jeton dans le code du projet. Si vous utilisez un dépôt existant avec origin déjà défini, vérifier `git remote -v` et réutiliser la bonne URL au lieu de recréer origin.

5. **Ouvrir Actions.** Sur la page du dépôt, cliquer l'onglet **Actions**. Un workflow nommé **CI - PostGIS geocoding DiaLog Lyon** doit démarrer automatiquement après le push. Si GitHub propose d'activer les workflows, les activer. Le workflow se lance également à chaque pull request.
6. **Lancer manuellement si nécessaire.** Dans Actions, cliquer le nom du workflow à gauche, puis **Run workflow**, sélectionner `main`, puis confirmer **Run workflow**. Le fichier doit être présent sur la branche par défaut pour voir ce bouton.
7. **Ouvrir le job** `PostgreSQL 17 / PostGIS 3.5 validation`. Vérifier spécialement les étapes « Verify installed PostGIS extension and version », « Apply all migrations including DiaLog », « SQL and PostGIS tests », « Real database integrations including DiaLog XML to engine » et « Spatial query EXPLAIN ANALYZE BUFFERS ».
8. **Reconnaître le succès.** L'exécution complète et toutes les étapes de validation doivent être vertes. Une exécution en cours, annulée, rouge ou une étape DB ignorée n'est pas une validation réussie. Les logs doivent montrer une version PostGIS réelle et les résultats des tests. Le statut de ce dépôt reste en attente jusqu'à examen de cette preuve.
9. **Récupérer les résultats.** Revenir au résumé de l'exécution ; dans **Artifacts**, télécharger `postgis-validation-<numéro>`. Il contient les logs et `spatial-plan.json`. Les fichiers restent disponibles 14 jours. Vous pouvez aussi utiliser « Download log archive » dans le menu de l'exécution.

### Ce qu'il faut renvoyer pour analyse

- URL de l'exécution GitHub Actions, identifiant du commit et statut final.
- Archive `postgis-validation-<numéro>` (à joindre ici, surtout si le dépôt est privé).
- Si l'exécution est rouge : nom de la première étape en échec et son message complet.
- Au minimum : postgis-version.log, migrations.log, migrations-replay.log, sql-tests.log, integration.log, spatial-plan.json et unit-tests.log.

Le simple badge vert sans logs ne suffit pas à examiner les résultats géospatiaux et les scénarios A/B/C.

### Badge CI

Badge du dépôt GitHub communiqué :

```markdown
[![CI PostGIS](https://github.com/john07-max/jepeuxstationner/actions/workflows/ci.yml/badge.svg)](https://github.com/john07-max/jepeuxstationner/actions/workflows/ci.yml)
```

## Structure et pièces de validation

```text
apps/demo/src/index.ts
packages/domain/src/index.ts
packages/engine/src/index.ts
packages/adapters/src/index.ts
packages/database/
  migrations/001_initial.sql
  migrations/002_permanent_rules.sql
  queries/resolve-zone.sql
  queries/load-coverage.sql
  queries/load-rules.sql
  src/read-snapshots.ts
  fixtures/integration.sql
  fixtures/spatial-plan.sql
  tests/schema.sql
  tests/geospatial.sql
  tests/temporal.sql
scripts/db.mjs
tests/engine.test.ts
tests/db-scripts.test.ts
tests/integration/database-engine.test.ts
.github/workflows/ci.yml
compose.yaml / .env.example / tsconfig.json / package.json / package-lock.json
```

Les neuf documents de référence restent présents. TEST_RESULTS.md sépare exécution locale et préparation CI ; TEST_MATRIX.md décrit les cas ; STATIC_DB_REVIEW.md contient uniquement une revue statique ; DELIVERY_PHASE_0_5.md inventorie les changements.

Références techniques : [image du projet PostGIS](https://github.com/postgis/docker-postgis), [requêtes paramétrées node-postgres](https://node-postgres.com/features/queries), [artefacts GitHub Actions](https://docs.github.com/en/actions/tutorials/store-and-share-data).

## Utiliser DiaLog

```bash
npm run test:dialog
npm run test:dialog:live
# Base PostgreSQL/PostGIS migrée nécessaire, y compris pour dry-run :
npm run sync:dialog -- --dry-run
npm run sync:dialog
```

Copier les variables DIALOG de `.env.example` si des limites personnalisées sont nécessaires. Aucun secret DiaLog. Aucun import live dans la CI principale. Le plan spatial DiaLog, les compteurs d'import et les scénarios A–E se trouvent dans integration.log. Ne pas lancer PostgreSQL/Docker dans Work ; utiliser GitHub Actions comme prévu.
