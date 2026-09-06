# DiaLog — PHASE 2

## Source vérifiée le 5 septembre 2026

- Endpoint public : https://dialog.beta.gouv.fr/api/regulations.xml
- GET, aucun compte, aucune clé. Paramètres utilisés explicitement : `includePermanent=true&includeTemporary=true&includeExpired=false`.
- Paramètres disponibles : ces trois booléens, défauts respectifs true, true, false. Aucun filtre communal ni pagination documentés pour cet export.
- [Documentation API du producteur](https://github.com/MTES-MCT/dialog/blob/main/docs/public/api.md).
- [Fiche officielle data.gouv.fr et licence](https://www.data.gouv.fr/datasets/base-de-donnees-nationale-de-la-reglementation-de-circulation) : Licence Ouverte / Open Licence 2.0. Conserver attribution DiaLog et date de récupération. Ne pas confondre avec la licence AGPL du code du producteur.
- [Modèle XML du producteur](https://github.com/MTES-MCT/dialog/blob/main/templates/api/regulations.xml.twig), [schémas DATEX](https://github.com/MTES-MCT/dialog/tree/main/docs/spec/datex2).

## Structure réellement observée

DATEX II **3**, `d2:payload`, `modelBaseVersion="3"`, type `TrafficRegulationPublication`, puis `trafficRegulationsFromCompetentAuthorities / trafficRegulationOrder / trafficRegulation`. Espaces de noms contrôlés ; pas de dépendance à un préfixe XML particulier. Extension `dx:geoJsonGeometry` contenant du GeoJSON. Il ne s'agit pas d'un flux DATEX 2 `SituationPublication`.

Le premier téléchargement d'observation a fourni 100 072 501 octets, 11 042 arrêtés. Types observés : SpeedLimit (7 059), AccessRestriction (3 804), StandingOrParkingRestriction (2 386), RoadOrCarriagewayOrLaneManagement (117), GeneralInstructionToRoadUsers (47). Ces nombres décrivent cet export, pas des constantes contractuelles.

Le parser importe uniquement `StandingOrParkingRestriction / parkingProhibited`. Les autres mesures, y compris inconnues, sont ignorées et comptées. L'export est un inventaire partiel des arrêtés numérisés : il ne prouve jamais une couverture complète des règles de stationnement.

## Architecture et mapping

`DiaLogHttpClient` télécharge et transmet le corps en chunks à `parseDiaLog`. Le résultat contient des `ImportedParkingRule`, représentation de stockage du même domaine avec fin nullable. `syncDiaLog` les conserve transactionnellement dans PostGIS. `databaseDiaLogAdapter` sélectionne réellement les géométries correspondant à une position et crée `DiaLogDataSourceAdapter implements DataSourceAdapter`. Son `load` projette des `ParkingRule[]` bornés à la durée demandée. Le moteur n'importe ni XML ni HTTP ni PostgreSQL.

| Donnée | Mapping |
| --- | --- |
| UUID de l'arrêté | préfixe de externalId et id interne |
| Sous-mesure sans UUID dans l'export | suffixe SHA-256 tronqué à 128 bits sur géométrie, début, véhicules, récurrence |
| parkingProhibited | effect FORBIDDEN |
| overallStartTime / overallEndTime | start ISO UTC / end ISO UTC ou null |
| Fin absente | permanent=true, borne supérieure PostgreSQL ouverte |
| status et fin passée | active=false si ordre non implemented, mesure non active ou période terminée |
| dx:geoJsonGeometry | géométrie EPSG:4326 |
| Répétitions temporelles | recurrence + limitation UNSUPPORTED_RECURRENCE |
| Conditions de véhicules/exceptions | vehicleConditions + limitation explicite |
| regulationId, description, publicUrl | référence à l'arrêté, explication et preuve de source |
| Récupération | retrievedAt et observedAt ; freshUntil calculée |
| Dernière mise à jour source | option sourceUpdatedAt ; absente dans l'export observé, jamais remplacée artificiellement par publicationTime |

Une modification de fin/date d'expiration, de description ou de statut actualise la même ligne. Si géométrie, début, véhicules ou récurrence changent, le suffixe change : ancienne ligne désactivée et nouvelle ligne insérée. L'UUID original reste identifiable. Ne pas prétendre disposer d'un identifiant de sous-mesure fourni par DiaLog.

## Géométrie

Point, LineString, Polygon et MultiPolygon sont conservés. MultiPoint et MultiLineString sont éclatés sans approximation en éléments simples ; GeometryCollection est décomposée récursivement (profondeur bornée). Les types observés incluaient LineString, MultiLineString, GeometryCollection, Point, Polygon et MultiPoint ; MultiPolygon est aussi couvert par fixtures.

Longitude puis latitude, coordonnées finies, deux dimensions, bornes mondiales, anneaux fermés. La validité topologique est contrôlée réellement avec ST_IsValid avant écriture et par contrainte SQL ; aucun ST_MakeValid silencieux. Les polygones utilisent **ST_Covers**, bordure comprise. Points et lignes utilisent **ST_DWithin sur geography**, distance en mètres, défaut **5 m**, configurable `DIALOG_SPATIAL_TOLERANCE_METERS` entre 0 et 15. Il s'agit d'une association à proximité, sans preuve du côté de rue. La ville et l'unique zone connue doivent couvrir la position ; côté inconnu ou zones ambiguës échouent vers UNKNOWN.

Les positions de requêtes restent en mémoire. L'inventaire importé est national ; l'exploitation MVP reste limitée aux villes/zones explicitement configurées dans le socle. Aucun périmètre réel de ville ni droit de stationnement n'est inventé par cette livraison.

## Temporalité, confiance et décision

Intervalles [début,fin), dates avec fuseau obligatoire. Permanents stockés avec fin null, projection bornée à la requête. Expirés conservés pour audit mais exclus de la requête actuelle. Les expirés déjà absents du flux sont désactivés logiquement, jamais supprimés. Les futures restrictions restent sélectionnables dans une période de séjour.

Le producteur fournit `recurringTimePeriodOfDay` et `recurringDayWeekMonthPeriod`. Leur interprétation complète, notamment fuseau et exceptions, est différée : conservation des champs, supported=false, UNKNOWN si une telle règle rencontre la requête. Même prudence pour les profils véhicules et arbres booléens non supportés. Aucune interdiction récurrente n'est transformée en interdiction permanente.

Fraîcheur par défaut **24 h après récupération**, configurable par import. `fresh_until` persiste aussi dans data_sources. Une règle permanente ancienne peut être fraîchement confirmée par le flux : son ancien début n'est pas sa date de récupération. Une règle périmée produit UNKNOWN.

`authority=OFFICIAL` signifie **origine publique**, `legalAuthority=informative` signifie **absence de vérité juridique absolue**. Une source informative ne peut jamais produire ALLOWED. Notice : « Information issue de DiaLog. La signalisation sur place et l'arrêté officiel prévalent. »

Le nouveau snapshot `purpose=RESTRICTIONS, complete=false` permet une interdiction explicite sans prétendre connaître toutes les autorisations. Sans interdiction active ni permission explicite : UNKNOWN. Les contradictions officielles restent UNKNOWN.

**Scénario B :** la fixture comporte une permission officielle fictive explicite jusqu'à H+2, puis une restriction DiaLog fictive. Le résultat est CONDITIONAL avec allowedUntil=H+2, alias de mustLeaveBefore. Une restriction future DiaLog seule donne UNKNOWN : son absence avant H+2 n'est pas une autorisation. Cette précision conserve le principe fondateur du projet.

## Import, erreurs, idempotence et dry-run

Clé unique `(source_id,external_id)`. Verrou transactionnel advisory par source ; validation géométrique, calcul des changements, upsert, désactivation et fraîcheur atomiques. Échec SQL : rollback. Une importation identique actualise la fraîcheur sans dupliquer ni compter une modification métier. Les tests d'intégration utilisent un schéma privé jetable, isolé des imports existants.

Deux lignes différentes revendiquant la même identité dans un export font échouer tout le flux : aucune sélection arbitraire. Rejet au niveau de l'arrêté : si une entrée est invalide, ses sous-règles ne sont pas importées partiellement. Au-delà de **1 % des arrêtés invalides**, échec global. Même seuil pour géométries invalides parmi les règles normalisées. Toute erreur tolérée interdit la désactivation des disparus ; les anciennes preuves conservent leur propre fraîcheur. Un XML tronqué, un DTD, un schéma incompatible ou une limite dépassée font échouer tout l'import. Un flux sans arrêté ne désactive rien. Les entrées inconnues non liées au stationnement sont ignorées normalement.

`--dry-run` télécharge réellement puis calcule insertions/modifications/désactivations en transaction **READ ONLY**, terminée par ROLLBACK. Il nécessite PostgreSQL et des migrations appliquées. Il ne simule pas un succès sans base. Le résultat est une estimation sur snapshot, susceptible de changer si un import concurrent termine ensuite.

Aucun XML national conservé en base. Le JSON normalisé ne contient que les champs utiles et les sous-conditions non supportées. Pas de données de recherche utilisateur. Logs JSON avec compteurs fetch/parse/sync ; aucune géométrie ou totalité de XML dans les logs opérationnels.

## Sécurité XML et performances

Bibliothèque `sax` 1.6.1, mode strict, namespaces, seules entités XML prédéfinies. DTD et déclarations SGML refusées, aucun téléchargement d'entité externe ni exécution. Saxes a été écarté car son dépôt est archivé. Ce parser contrôle le profil nécessaire ; il n'effectue pas de validation XSD exhaustive.

128 MiB maximum décompressés, profondeur XML 64, 50 000 nœuds et 2 MiB de texte par arrêté, collections géométriques profondeur 8. Un arbre d'arrêté à la fois, pas de chaîne XML nationale en mémoire ; seules les règles utiles normalisées sont accumulées. Le client HTTP couvre téléchargement et parsing par un timeout 60 s ; un retry maximum sur réseau/5xx/timeout, délai 500 ms. 429 échoue avec Retry-After typé sans retry automatique. URL officielle fixe, redirections refusées.

Test live exécuté : 100 072 501 octets, 9 675 règles normalisées, dont 7 322 supportées ; 0 arrêté invalide. Environ **23,7 s** de bout en bout, **4,0 s** dans la boucle lecture/parsing, **272,5 Mo RSS en fin de test**, 96,4 Mo heap utilisée. Mesures indicatives ; RSS finale n'est pas le pic garanti. Un premier passage sur fichier local prenait environ 3,1 s. Deux téléchargements seulement : observation et suite live.

Les durées d'insertion sont journalisées par syncDiaLog ; **non mesurées localement sans PostgreSQL**. Un test CI peuple 20 000 géométries supplémentaires et journalise EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) sur la requête exacte ; aucun paramètre planner n'est forcé. Le plan figure dans integration.log. Le test spatial historique à 40 000 zones reste actif. Les allers-retours SQL par règle sont une limite connue à mesurer en CI avant optimisation.

## Commandes

```bash
npm ci
npm run validate
npm run test:dialog
npm run test:dialog:live
# Sur machine disposant de Docker, ou directement avec DATABASE_URL vers PostgreSQL/PostGIS :
npm run db:up
npm run db:migrate
npm run sync:dialog -- --dry-run
npm run sync:dialog
npm run validate:db
```

Ne pas utiliser db:up dans Work sans Docker. La CI principale le fait sur GitHub. Le live DiaLog est un workflow manuel indépendant ; la CI principale n'appelle aucune API externe. Voir TEST_RESULTS.md pour les preuves et validations restantes.

## Correctif d'idempotence du 6 septembre 2026

La comparaison utilise désormais un fingerprint métier canonique ; l'ordre des propriétés JSONB n'influence plus updated. Les dates de récupération/observation/fraîcheur et sourceUpdatedAt n'y participent pas. La fraîcheur est actualisée séparément, uniquement si différente. Une règle strictement identique ne repasse plus par l'upsert métier. Dates d'application, géométrie, conditions et provenance fonctionnelle restent substantielles. Voir ADR-037 et IDEMPOTENCE_FIX.md. Aucune migration nécessaire.
