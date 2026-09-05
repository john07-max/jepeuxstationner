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
