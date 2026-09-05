# JePeuxStationner — PHASE 0.5

Fondations du MVP et préparation de sa validation PostgreSQL/PostGIS sur GitHub Actions. Données exclusivement fictives ; aucun fournisseur externe, aucune interface web, aucune PHASE 1 commencée.

```text
READY FOR PHASE 1: NO
Reason: PostgreSQL/PostGIS runtime validation pending.
```

## Architecture conservée

Monorepo npm workspaces, Node.js 24, TypeScript strict, PostgreSQL 17/PostGIS 3.5. Le moteur reste pur, sans dépendance SQL. `pg` et ses types servent à la validation et à la lecture des fixtures ; aucun fournisseur officiel n'est branché. Voir ARCHITECTURE.md et DECISIONS.md.

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
git commit -m "Prepare Phase 0.5 PostGIS validation"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/jepeuxstationner.git
git push -u origin main
```

Si Git demande votre identité, définir `git config user.name "Votre nom"` et `git config user.email "Votre email GitHub"`, puis reprendre à `git commit`. S'authentifier via le navigateur si Git le propose. Ne pas coller de mot de passe ou de jeton dans le code du projet. Si vous utilisez un dépôt existant avec origin déjà défini, vérifier `git remote -v` et réutiliser la bonne URL au lieu de recréer origin.

5. **Ouvrir Actions.** Sur la page du dépôt, cliquer l'onglet **Actions**. Un workflow nommé **Phase 0.5 - PostgreSQL PostGIS** doit démarrer automatiquement après le push. Si GitHub propose d'activer les workflows, les activer. Le workflow se lance également à chaque pull request.
6. **Lancer manuellement si nécessaire.** Dans Actions, cliquer le nom du workflow à gauche, puis **Run workflow**, sélectionner `main`, puis confirmer **Run workflow**. Le fichier doit être présent sur la branche par défaut pour voir ce bouton.
7. **Ouvrir le job** `PostgreSQL 17 / PostGIS 3.5 validation`. Vérifier spécialement les étapes « Verify installed PostGIS extension and version », « Apply migrations 001 and 002 », « SQL and PostGIS tests », « Real database to engine integration A B C » et « Spatial query EXPLAIN ANALYZE BUFFERS ».
8. **Reconnaître le succès.** L'exécution complète et toutes les étapes de validation doivent être vertes. Une exécution en cours, annulée, rouge ou une étape DB ignorée n'est pas une validation réussie. Les logs doivent montrer une version PostGIS réelle et les résultats des tests. Le statut de ce dépôt reste en attente jusqu'à examen de cette preuve.
9. **Récupérer les résultats.** Revenir au résumé de l'exécution ; dans **Artifacts**, télécharger `postgis-validation-<numéro>`. Il contient les logs et `spatial-plan.json`. Les fichiers restent disponibles 14 jours. Vous pouvez aussi utiliser « Download log archive » dans le menu de l'exécution.

### Ce qu'il faut renvoyer pour analyse

- URL de l'exécution GitHub Actions, identifiant du commit et statut final.
- Archive `postgis-validation-<numéro>` (à joindre ici, surtout si le dépôt est privé).
- Si l'exécution est rouge : nom de la première étape en échec et son message complet.
- Au minimum : postgis-version.log, migrations.log, migrations-replay.log, sql-tests.log, integration.log, spatial-plan.json et unit-tests.log.

Le simple badge vert sans logs ne suffit pas à examiner les résultats géospatiaux et les scénarios A/B/C.

### Badge CI

L'URL du dépôt n'est pas encore connue : aucun badge réel n'est inventé. Après création, remplacer VOTRE-COMPTE et VOTRE-DEPOT dans cette ligne puis la placer en haut du README :

```markdown
[![CI PostGIS](https://github.com/VOTRE-COMPTE/VOTRE-DEPOT/actions/workflows/ci.yml/badge.svg)](https://github.com/VOTRE-COMPTE/VOTRE-DEPOT/actions/workflows/ci.yml)
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
