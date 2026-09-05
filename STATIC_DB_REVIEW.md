# Revue statique PostgreSQL/PostGIS — PHASE 0.5

Cette revue est une inspection du texte et de la configuration. Elle ne valide ni l'exécution SQL, ni les réponses PostGIS, ni le plan de requête. Docker, PostgreSQL et PostGIS n'ont pas été exécutés dans Work.

| Fichier / composant | Constat statique |
| --- | --- |
| compose.yaml | Même image postgis/postgis:17-3.5, port local 5432, base/utilisateur parking, mot de passe variable, volume persistant de développement et healthcheck pg_isready |
| .env.example | POSTGRES_PASSWORD et mot de passe DATABASE_URL concordent ; URL vers 127.0.0.1:5432/parking ; opt-in reset commenté |
| ci.yml | Même Compose, variables concordantes, Node 24, SQL readiness puis contrôle PostGIS, erreurs propagées par bash avec pipefail malgré tee |
| migration 001 | Conservée ; types, clés étrangères, SRID 4326, validité géométrique et index GiST |
| migration 002 | Transaction additive ; trouve le CHECK temporel d'origine via pg_constraint ; permet une fin absente et refuse un début inconnu ; inscrit version 2 |
| db:migrate | Ordre numérique, versions suivies, verrou PostgreSQL ; refus d'historique inattendu ; rejeu prévu en CI |
| resolve-zone.sql | Paramètres $1=longitude,$2=latitude,$3=ville ; ST_Covers, pas LIMIT 1 ; index spatial compatible |
| read-snapshots.ts | Rejette coordonnées hors limites, zéro/multiples zones et côté inconnu ; projection des Date vers ISO UTC ; aucune dépendance du moteur vers SQL |
| load-coverage.sql | Exige une couverture contenant la période entière ; ne fabrique pas de couverture depuis les règles |
| load-rules.sql | Filtre les chevauchements temporels ; permanente limitée à la fenêtre via greatest/least PostgreSQL ; fraîcheur transmise intacte |
| fixtures et tests | Données synthétiques, transactions annulées, cas asymétriques pour l'ordre des coordonnées, conflits explicites |
| db:explain | 40 000 zones, ANALYZE, GiST contrôlé, EXPLAIN ANALYZE BUFFERS JSON ; aucun paramètre du planificateur forcé |
| db:reset | Refuse cible distante, autre nom de base ou absence d'opt-in ; ne supprime pas le schéma public ; non exécuté ici |

Les deux fichiers YAML ont été parsés localement et leurs variables/étapes ont été examinées. scripts/db.mjs a passé node --check. Ce contrôle de syntaxe ne remplace pas GitHub Actions. Les points restant à confirmer sont notamment l'application effective de 002, le code SQLSTATE de rejet SRID, le résultat des requêtes, les transactions et le plan réellement choisi.

L'image reconnue PostGIS initialise normalement l'extension dans POSTGRES_DB. La CI exige qu'elle soit réellement présente avant les migrations ; si ce prérequis cesse d'être vrai, elle échouera volontairement et fournira ses logs, plutôt que masquer l'absence.
