# Sources de données

Une seule implémentation active : FictionalDataSourceAdapter, id fixture. fixture-city et fixture-curb-a ne représentent aucun lieu réel. fixture://orders/demo-001 n'est pas une source officielle réelle : synthetic=true sur chaque preuve, propagé vers la décision.

DataSourceAdapter.load reçoit ville, zone exacte, début et fin ; retourne un RuleSnapshot avec identité adapter, couverture temporelle et géographique, déclaration complete, preuve de couverture et règles. AbortSignal permet d'annuler les futures opérations. Toute erreur ou expiration du délai fait échouer l'ensemble vers UNKNOWN, sans afficher les erreurs internes.

Une preuve nécessite référence, version, autorité, nature, observedAt et freshUntil. La fraîcheur est évaluée par rapport à l'horloge injectée ; la validité juridique prévue est représentée séparément par la période de règle. Aucun délai de fraîcheur réel n'est inventé.

Avant connexion réelle : vérifier licence, statut officiel, zone/côté, exhaustivité, mises à jour et retrait d'arrêtés. Établir une validation de schéma runtime pour les payloads externes avant leur conversion vers les types internes. Les interfaces TypeScript ne valident pas seules un JSON externe. Ne pas marquer complete sur la seule réussite d'une requête HTTP. Conserver des versions immuables des sources.

Les deux périodes de la fixture sont volontairement bornées : le fournisseur n'étend jamais sa couverture à la période demandée. Aucun appel réseau ne figure dans le code.


## Fixtures PostgreSQL PHASE 0.5

packages/database/fixtures/integration.sql introduit une seule ville fictive ci-city pour les tests, avec des sources fixture://ci/... toutes synthetic=true. Les zones servent à tester les cas métier, les bordures, MultiPolygon et ambiguïtés. La ville plan-city est une fixture distincte, uniquement temporaire, de mesure du plan spatial ; cela n'étend pas le MVP à plusieurs villes réelles.

Les fixtures sont insérées dans des transactions annulées et ne sont pas un seed de production. Le pont SQL fait un ST_Covers réel puis charge couverture et règles officielles/secondaires, sans éliminer les données périmées. Les scénarios et attentes sont détaillés dans TEST_MATRIX.md. Aucune API externe connectée.
