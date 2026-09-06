# Architecture

Monorepo npm workspaces, modules ESM privés, compilation TypeScript commune vers dist. Pas de publication de packages en phase 0 ; imports relatifs explicites entre sources, respectant les dépendances ci-dessous. Une compilation unique suffit à ce socle et évite un orchestrateur supplémentaire.

| Composant | Dépendances | Responsabilité |
| --- | --- | --- |
| domain | aucune | Modèles immuables et port DataSourceAdapter |
| engine | domain | Décision pure, agrégation temporelle, orchestration avec délai |
| adapters | domain | Fournisseur fictif normalisé |
| database | PostgreSQL + PostGIS | Modèle relationnel géospatial indépendant du moteur |
| demo | engine, adapters | Composition locale et sortie JSON |

Le domaine ne dépend ni de SQL ni d'un framework web. Une future application serveur composera les adapters ; elle ne déplacera pas les règles métier dans les contrôleurs. Le frontend mobile-first consommera une décision sérialisée.

## Modèle PostGIS

cities contient le périmètre MultiPolygon EPSG:4326 et le fuseau de référence. parking_zones contient un périmètre et un côté explicite. data_sources conserve la preuve versionnée, son caractère fictif, son origine et sa fraîcheur. parking_rules référence obligatoirement une source et une zone de la même ville. source_coverage distingue couverture exhaustive déclarée et simple présence de données. schema_migrations suit les versions.

Index GiST sur géométries et périodes tstzrange, index sur zone. Les contraintes rejettent géométries vides/invalides, intervalles vides/non bornés et conditions incompatibles avec l'effet. Les migrations restent SQL natives pour garder PostGIS explicite. La contenance d'une zone dans une ville et la qualité du côté de chaussée seront contrôlées à l'ingestion ; le schéma seul ne les garantit pas.

ST_Covers inclut les frontières : si plusieurs zones correspondent, le futur résolveur doit renvoyer une ambiguïté, jamais choisir la première. Une adresse ne suffit pas à garantir un côté de chaussée. Les coordonnées sont des paramètres éphémères.

## Dépendances différées

Le choix de la ville et l'audit de sources conditionnent l'adapter officiel, la politique de fraîcheur, la normalisation des horaires locaux et l'interface utilisateur. Pas de Redis, moteur de recherche, ORM, queue ni infrastructure publicitaire prématurés.

Références : [PostGIS ST_Covers](https://postgis.net/docs/ST_Covers.html), [TypeScript strict](https://www.typescriptlang.org/tsconfig/#strict), [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html).


## PHASE 0.5 — validation réelle préparée

La structure existante reste en place. packages/database/src/read-snapshots.ts dépend seulement du domaine et du type Client de pg ; le moteur ne dépend toujours pas du client SQL. Le code de test compose ces couches, avec une transaction REPEATABLE READ et rollback des fixtures. Ce pont ne traite aucune adresse ni donnée externe.

Le script scripts/db.mjs charge DATABASE_URL, contrôle PostGIS, applique les migrations versionnées et exécute les fixtures SQL. Les scripts npm lisent facultativement .env via Node 24 ; les variables du job GitHub prennent priorité. La base de CI utilise exactement compose.yaml ; sa durée de vie se limite au job.

La migration 002 autorise uniquement une fin de règle non bornée pour représenter une règle permanente. Les preuves de couverture restent finies. Les migrations 001 et 002 restent transactionnelles ; le runner ajoute un verrou de migration et un rejeu sans changement des versions connues.


## PHASE 1 — géocodage indépendant

Ajouts dans les packages existants : domain/src/geocoding.ts et adapters/src/geocoding/*.ts. Aucun remplacement de composant de stationnement et aucune migration. Les dépendances sont uniquement celles de la plateforme Node 24 ; aucun package npm ajouté.

Le provider normalise le JSON externe vers GeocodingResult. Son client HTTP concentre tous les appels réseau et partage un limiteur par origine dans le processus. GeocodingCache est un port remplaçable, implémenté en RAM ; GeocodingProvider est le port consommé par le contrôleur de debounce et la CLI. Le moteur n'importe aucun de ces composants.

Le provider et le cache RAM actuel sont côté serveur Node. L'abstraction consommateur permet de préparer la future interface sans la créer. La conversion coordonnées → zone/côté fiables reste distincte et n'est pas branchée au moteur ici. Voir GEOCODING.md.

## Extension PHASE 2

Les packages existants sont conservés. `adapters/src/dialog` centralise transport XML, parser et DataSourceAdapter ; `domain/src/imported-rule.ts` représente une restriction persistable indépendante du fournisseur ; `database/src/dialog.ts` réalise transaction, lecture PostGIS et projection. Migration additive 003, requête dialog-at-position.sql, CLI sync-dialog. Pas de dépendance SQL/XML ajoutée au moteur. Voir DIALOG.md et ADR-026 à 036.


## PHASE 3 — modules Lyon ajoutés

- `domain/local-parking.ts` : couverture positive, véhicule, tarif, parking, DTO.
- `adapters/lyon` : inventaire officiel normalisé, rapprochement, calendrier, prix UNO, adaptateur DataSourceAdapter, statique et observation temps réel à mapping revu.
- `database/lyon.ts` + migration 004 : inventaires idempotents, preuves de places indépendantes, requêtes ST_Covers / geography, stockage des observations.
- `application/check-parking.ts` : géocodage → résolution d'une place → adaptateurs → décision → tarification → parkings si interdit. `application/lyon.ts` compose les implémentations PostgreSQL existantes.
- `apps/demo` : commandes sync:lyon:*, lyon:coverage et check:parking. Aucune UI.

Le moteur central ajoute seulement scope=GENERAL et une priorité générique limitée des interdictions spécifiques. Aucune constante Lyon dans ce moteur. Les tables historiques, DiaLog et le géocodage restent inchangés. Aucun axe géographique ne devient automatiquement une place vérifiée. Le stockage ne conserve ni adresse soumise ni profil utilisateur.

## PHASE 4 : couche HTTP et web

`apps/web/server` (Node http, pool PG) → `CheckParkingService.checkPosition` → moteur/adapters existants ; React dans `apps/web/src` consomme uniquement l'API normalisée. Vite compile le frontend en dist/web ; tsc compile l'API en dist/apps/web/server. Carte dynamique avec données locales, aucun fournisseur dans le navigateur. Démo explicite dans tests/support séparée de l'entrée production. Aucune migration ni changement de priorité du moteur.
