# Sources de données

Historique PHASE 0 (avant DiaLog) : une seule implémentation active : FictionalDataSourceAdapter, id fixture. fixture-city et fixture-curb-a ne représentent aucun lieu réel. fixture://orders/demo-001 n'est pas une source officielle réelle : synthetic=true sur chaque preuve, propagé vers la décision.

DataSourceAdapter.load reçoit ville, zone exacte, début et fin ; retourne un RuleSnapshot avec identité adapter, couverture temporelle et géographique, déclaration complete, preuve de couverture et règles. AbortSignal permet d'annuler les futures opérations. Toute erreur ou expiration du délai fait échouer l'ensemble vers UNKNOWN, sans afficher les erreurs internes.

Une preuve nécessite référence, version, autorité, nature, observedAt et freshUntil. La fraîcheur est évaluée par rapport à l'horloge injectée ; la validité juridique prévue est représentée séparément par la période de règle. Aucun délai de fraîcheur réel n'est inventé.

Avant connexion réelle : vérifier licence, statut officiel, zone/côté, exhaustivité, mises à jour et retrait d'arrêtés. Établir une validation de schéma runtime pour les payloads externes avant leur conversion vers les types internes. Les interfaces TypeScript ne valident pas seules un JSON externe. Ne pas marquer complete sur la seule réussite d'une requête HTTP. Conserver des versions immuables des sources.

Les deux périodes de la fixture sont volontairement bornées : le fournisseur n'étend jamais sa couverture à la période demandée. Aucun appel réseau ne figure dans cet adaptateur fictif.


## Fixtures PostgreSQL PHASE 0.5

packages/database/fixtures/integration.sql introduit une seule ville fictive ci-city pour les tests, avec des sources fixture://ci/... toutes synthetic=true. Les zones servent à tester les cas métier, les bordures, MultiPolygon et ambiguïtés. La ville plan-city est une fixture distincte, uniquement temporaire, de mesure du plan spatial ; cela n'étend pas le MVP à plusieurs villes réelles.

Les fixtures sont insérées dans des transactions annulées et ne sont pas un seed de production. Le pont SQL fait un ST_Covers réel puis charge couverture et règles officielles/secondaires, sans éliminer les données périmées. Les scénarios et attentes sont détaillés dans TEST_MATRIX.md. Aucune API externe connectée à ce stade historique.


## PHASE 1 — source réelle de géocodage uniquement

Le provider Géoplateforme utilise GET https://data.geopf.fr/geocodage/search et /reverse, index address (BAN). Le contrat officiel https://data.geopf.fr/geocodage/openapi.yaml a été consulté pendant le développement. La limite publiée est de 50 requêtes/s/IP ; l'application vise 5/s/processus par défaut. Les paramètres d'autocomplete sont 0/1 ; depcode est le filtre département pour les adresses.

Ces données localisent des adresses, voies et communes ; elles ne sont jamais injectées comme règles de stationnement ni comme preuves d'autorisation. Source normalisée dans les résultats : geoplateforme-ban. Aucun appel à l'ancienne API dépréciée, aucune donnée de stationnement externe connectée à la PHASE 1 ; DiaLog est ajouté ci-dessous en PHASE 2.

Les fixtures HTTP des tests unitaires sont synthétiques. Les tests live consultent cinq lieux publics, sans historique de recherche utilisateur. Leur résultat partiel (trois succès et deux timeouts) figure dans TEST_RESULTS.md ; il ne doit pas être présenté comme cinq succès.

## DiaLog connecté en PHASE 2

Source officielle vérifiée : https://dialog.beta.gouv.fr/api/regulations.xml ; DATEX II 3, filtres includePermanent=true, includeTemporary=true, includeExpired=false. Réutilisation sous Licence Ouverte 2.0, attribution DiaLog et date de récupération. Origine officielle, valeur informative ; l'arrêté et la signalisation prévalent. Inventaire partiel, aucune autorisation déduite d'une absence. Contrat, liens officiels, observations réelles et limites dans DIALOG.md.


## PHASE 3 — sources Lyon auditées

Audit détaillé dans LYON_AUDIT.md ; endpoints et licences dans data/lyon/sources.json. Captures officielles SHA256 dans data/lyon/manifest.json : annexe municipale (1 142 voies interprétées), WFS trame viaire Métropole (7 964 tronçons Lyon), WFS parkings statiques Métropole (189 éléments). Les deux WFS structurés sont réutilisés sous LO 2.0 avec attribution Métropole de Lyon. Les pages municipales sont isolées dans une configuration versionnée ; aucun scraping par recherche.

La donnée temps réel n'est pas intégrée en production : HTTP 401 constaté, licence metadata Other (Public Domain), champs d'observation non confirmés. Le test live manuel doit observer le schéma avant renseignement du mapping explicite. Les tests hors réseau utilisent des observations fictives identifiées comme telles.

Le rapprochement de noms et axes obtient 96,58 %, mais aucune place de stationnement n'est certifiée. Le registre local garde URL, licence, version et date lorsque disponibles ; les dates de publication inconnues ne sont pas inventées. Lire LYON.md pour les critères de fraîcheur et les règles non intégrées.
