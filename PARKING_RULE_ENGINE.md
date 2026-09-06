# Moteur de décision 0.0.2

Entrée : ParkingQuery normalisée (ville, zone/côté déjà identifié, instants explicites), snapshots normalisés, horloge evaluatedAt injectée. Sortie : ParkingDecision avec statut global, segments, motifs, preuves, version moteur et indicateur synthetic. Aucun état mutable ni accès base dans evaluate.

## Algorithme

1. Valider requête et timestamps avec offset ; refuser périodes nulles/inversées.
2. Exiger au moins un snapshot, sans doublon adapter, correspondant exactement à la zone et à la ville.
3. Exiger une couverture complète et fraîche sur toute la période pour chaque adapter configuré.
4. Vérifier identité, périodes, sources, doublons et conditions de toutes les règles. Une règle périmée ou mal formée fait échouer ce snapshot, même si elle ne concerne qu'un autre instant.
5. Découper [début, fin) à chaque début/fin de règle rencontré.
6. Pour chaque segment, considérer les règles officielles applicables. Aucun effet officiel : UNKNOWN. Plusieurs effets officiels différents : UNKNOWN. Effet unique : conserver cet effet, ses conditions et les identifiants de règle.
7. Agréger : interdit au début du séjour => FORBIDDEN ; sinon un segment UNKNOWN => UNKNOWN ; sinon une interdiction future => CONDITIONAL avec mustLeaveBefore ; sinon des conditions => CONDITIONAL ; sinon ALLOWED.

Une interdiction partielle n'affirme pas une interdiction pendant tout le séjour : les segments exposent précisément la période concernée. Un conflit officiel sur un même segment reste UNKNOWN même si une source interdit. Ce choix conservateur ne tranche aucune hiérarchie juridique non documentée.

Les règles conditionnelles cumulées exposent toutes les obligations ; le moteur ne vérifie ni paiement ni permis. Il n'existe aucun fallback « pas d'interdiction = permis ». Les limites de segments sont exclusives à droite, pour éviter les doubles applications aux transitions.

Les preuves de toutes les règles reçues sont conservées dans la réponse, y compris les sources secondaires non décisives ; les ruleIds de chaque segment identifient les règles utilisées. En absence de données, aucune preuve n'est fabriquée. Les causes UNKNOWN sont traçables via reasons, même lorsqu'aucune source n'a pu être chargée.

## Non pris en charge

Récurrences hebdomadaires, exceptions, jours fériés, catégories de véhicule et dérogations de résident. Un futur normaliseur devra produire des intervalles absolus exacts dans le fuseau de la ville, avec tests heure d'été/hiver. Ne jamais approximer ces règles dans l'adapter.

## Tests

Tests de comportements métier et d'intégration mémoire avec node:test, compilation stricte préalable. Aucun appel externe. SQL testé séparément sur une véritable instance PostGIS, jamais simulé par SQLite.


## Adaptation PHASE 0.5

Le scénario B demandé est permis au début mais nécessite un départ avant une interdiction future. `mustLeaveBefore` est l'instant du premier segment FORBIDDEN ; les preuves de ce segment restent disponibles. CONDITIONAL ne valide jamais le maintien du véhicule pendant ce segment. Le changement est inscrit dans ADR-015 et trois cas de régression vérifient le début interdit, une lacune avant interdiction et plusieurs changements successifs.

Le pont SQL ignore uniquement les règles dont la période ne chevauche pas la requête, mais ne masque jamais une source périmée. Une règle permanente a une fin SQL non bornée ; le moteur reçoit son intersection avec la fenêtre de requête. Il continue à ne manipuler que des périodes finies. La couverture doit elle-même rester complète, fraîche et bornée.

Les tests DB → moteur sont dans tests/integration, séparés des tests locaux. Ils n'ont pas encore été exécutés sur PostgreSQL/PostGIS au moment de cette livraison.

## PHASE 2 — moteur 0.0.3

Snapshot facultatif purpose=RESTRICTIONS : inventaire incomplet accepté exclusivement pour des FORBIDDEN d'origine officielle et de valeur informative. Jamais ALLOWED à partir d'une telle source, même avec complete=true. Les autres snapshots gardent les contraintes historiques de couverture. Conflits, sources périmées et règles non supportées donnent UNKNOWN. Le moteur ignore DATEX ; l'adaptateur filtre la géométrie et borne les périodes.

allowedUntil est un alias de mustLeaveBefore, présent seulement lorsque la durée commence par une permission explicite puis rencontre une interdiction. Une restriction DiaLog future seule conserve UNKNOWN. Voir DIALOG.md pour la qualification du scénario B.


## PHASE 3 — permission générale et service applicatif

Une règle peut explicitement porter `scope: GENERAL`. Dans un segment temporel, une interdiction officielle spécifique écarte uniquement les permissions générales. Une contradiction entre prescriptions spécifiques conserve UNKNOWN ; la source secondaire ne remplace pas une prescription officielle. Aucun traitement par nom de ville.

L'adaptateur Lyon ne produit une permission générale qu'après preuve d'un emplacement matérialisé non ambigu, d'une voie entière documentée et d'une fraîcheur acceptable. Sans cela, UNKNOWN, même si DiaLog est vide. Le calendrier devient des intervalles normalisés : ALLOWED pendant les périodes payantes comme gratuites si la couverture le justifie ; le paiement est exprimé séparément par pricing. Une interdiction future conserve allowedUntil.

Le prix est évalué par LyonParkingPricingEngine, hors du moteur d'autorisation. L'orchestration CheckParkingService se charge du géocodage et des trois parkings proches lorsque FORBIDDEN. Une panne de recherche de parkings ne supprime pas l'interdiction. Voir LYON.md pour les limites UNO, résident, NOCTURNE et durées.
