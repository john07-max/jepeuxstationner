# Pilote Lyon — PHASE 3

Le code du pilote et les captures officielles sont livrés. **Le service n'est pas encore exploitable pour autoriser du stationnement réel** : aucune place matérialisée n'est certifiée, le temps réel répond 401 depuis Work, et la nouvelle validation PostgreSQL/PostGIS doit être exécutée sur GitHub. La CI verte PHASE 2 confirmée par l'utilisateur ne valide pas automatiquement ces nouveaux changements.

## Sources et licences

L'audit complet et ses évolutions d'accès sont dans [LYON_AUDIT.md](LYON_AUDIT.md). Les endpoints exacts sont dans `data/lyon/sources.json` et les constantes des adaptateurs. Captures structurées de la Métropole sous Licence Ouverte 2.0 ; attribution : Métropole de Lyon, données récupérées le 6 septembre 2026, traitements JePeuxStationner. Arrêté municipal 2026RP48956 et annexe 1 : textes administratifs publics, aucune licence spécifique affirmée. Temps réel : les métadonnées indiquent « Other (Public Domain) », licence exacte à confirmer avant réutilisation.

Les montants viennent de la page officielle de tarification progressive ; version de vérification 06/09/2026. Publication initiale non devinée. Les dates éditoriales à minuit UTC ont une précision au jour.

## Couverture réellement obtenue

| Mesure | Résultat |
| --- | ---: |
| Voies officielles extraites, pages 1–62 | 1 142 |
| Tronçons lyonnais officiels téléchargés | 7 964 |
| Voies avec rapprochement géographique unique | 1 103 |
| Ambiguës | 0 |
| Sans correspondance | 39 |
| Taux de rapprochement des axes | 96,58 % |
| Voies entières rapprochées éligibles à une vérification de place | 1 017 |
| Emplacements de stationnement effectivement certifiés | **0** |
| Parkings métropolitains statiques normalisés | 189 |
| Dont INSEE Lyon 69123 | 121 |
| Accès explicitement « tous » dans la Métropole | 32 |
| Capacités inconnues (valeur source -1) | 126 |
| Observations temps réel réelles intégrées | **0** |

Le taux 96,58 % n'est **pas** un taux de couverture permettant ALLOWED. Le rapport détaillé `data/lyon/coverage-report.json` liste chaque voie, statut, page et identités de tronçon ; la commande de reproduction fournit aussi les géométries. Aucun import PostgreSQL n'a été exécuté dans Work. Les captures ont été téléchargées, extraites et normalisées localement.

La résolution exige une seule zone exacte via ST_Covers, un côté connu, une place vérifiée liée à une voie entière éligible et des preuves fraîches. L'import des axes ne remplit jamais `lyon_verified_spaces`. Il faut des polygones de places et un périmètre administratif officiels ou vérifiés, avec preuves et dates, avant toute activation de la couverture. Un buffer d'axe et un géocodage de rue ne remplacent pas cette vérification. Les fixtures SQL sont explicitement fictives.

L'extraction PDF est reproductible avec Python + pdfplumber **0.11.8** :

```bash
python scripts/extract-lyon-annex.py annexe-officielle.pdf data/lyon/streets.json
```

Référence et SHA256 du PDF dans streets.json. Aucun OCR. Changement du nombre de pages, des colonnes ou doublon : arrêt. Pages 63–66 quarantainées car format distinct ; pas d'interprétation silencieuse. Toute nouvelle version exige une revue documentaire et une actualisation des tests de capture.

## Règles et tarifs

Le périmètre est celui des **voitures visiteuses, régime UNO**. Généralement payant de 9h à 19h les jours ouvrables ; dimanches et jours fériés gratuits. Calendrier public français calculé avec date-holidays, fuseau Europe/Paris et changements d'heure pris en compte. Août n'est pas gratuit pour les visiteurs.

La permission générale normalisée porte scope=GENERAL. Une interdiction officielle spécifique DiaLog prévaut ; une interdiction future entraîne CONDITIONAL et allowedUntil. Deux prescriptions officielles spécifiques contradictoires restent UNKNOWN. L'absence de DiaLog ne crée aucune permission.

Tarification séparée, paliers publiés de 30 min à 10h :

| Classe | Profil visiteur pris en charge |
| --- | --- |
| Réduit | Thermique/hybride rechargeable ≤1 000 kg ; électrique ≤2 100 kg |
| Standard | Thermique >1 000 à 1 525 kg ; hybride rechargeable >1 000 à 1 900 kg |
| Majoré | Au-dessus des seuils précédents |

Sans énergie/poids, PAID peut être déterminé mais aucun montant n'est fourni. Pas d'interpolation entre paliers ni de calcul multi-journées. `pricing.status` décrit le début de la période ; `validUntil` sa prochaine transition ou la fin demandée. `amount`, s'il existe, concerne la durée évaluée, arrêtée avant une interdiction future. Pour une décision UNKNOWN, le prix de voirie reste UNKNOWN. Une interdiction sur une position documentée peut coexister avec PAID/FREE : le tarif ne change jamais l’autorisation.

Non intégrés : droits résidents/artisans, situations sociales, dérogations, NOCTURNE promenade Annie et Régis Neyret, voies partielles, places réservées non caractérisées, séjours >24h ou >600 minutes payantes. Le modèle d'exception datée existe et est testé ; aucune éligibilité n'est présumée. L'article 11 imposant de vérifier la signalisation chaque 24h n'est pas converti en droit de stationner 24h.

## Parkings et fraîcheur

Le flux statique fournit géométrie Point WGS84, identité officielle, capacité lorsqu'utilisable, adresse et tarifs horaires parfois disponibles. Les champs absents restent absents. `info` est du texte libre ; aucun horaire n'en est déduit automatiquement. Le champ info_temps_reel ne donne aucun nombre de places libres. Accès abonné ou inconnu : parking conservé en inventaire mais exclu des suggestions publiques automatiques.

Recherche PostGIS : ST_DWithin sur geography, ST_Distance en mètres, tri stable, rayon 1 500m et limite 3 pour le fallback. Rayon configurable par appel jusqu'à 10km, limite jusqu'à 20. Une panne du fallback conserve la décision FORBIDDEN et ajoute un avertissement.

Disponibilité : seuil `PARKING_REALTIME_MAX_AGE=180` secondes par défaut, soit trois cycles d'une minute annoncés pour LPA, **pas une fréquence garantie pour tous les opérateurs**. Seuil atteint, date future, compte incohérent ou absence : realtime=UNKNOWN, compte absent, parking conservé. Pas de déduction occupied=capacity-available. Une observation plus ancienne ne remplace pas une récente.

La collecte temps réel est implémentée derrière un mapping explicite des champs réellement vérifiés. Le flux réel étant inaccessible dans Work, aucun mapping par défaut n'est deviné. L'audit live journalise les noms de champs si l'accès devient possible ; il faut ensuite confirmer leur sens, l'identité commune avec le statique et l'horodatage de l'observation. La variable LYON_REALTIME_MAPPING reste vide tant que cette revue n'est pas faite. Aucun succès temps réel n'est annoncé dans cet état.

Règles éditoriales : revue avant **06/10/2026**. Axes : âge maximum 7 jours pour une couverture positive. Une nouvelle collecte des axes ne renouvelle pas l'arrêté. Un fichier archivé garde le timeStamp d'origine. Les caractéristiques statiques de parkings restent consultables avec la provenance et la date de collecte ; leur publication ne garantit pas l'ouverture actuelle. Fréquences opérationnelles suggérées : axes hebdomadaires, statique quotidien, observations chaque minute une fois le flux vérifié. Aucun ordonnanceur n'est installé dans cette phase.

## Commandes

Sans base ni réseau métier :

```bash
npm ci
npm run validate
npm run test:lyon
npm run lyon:coverage -- --file data/lyon/roads.geojson
```

Avec une vraie base PostgreSQL/PostGIS disponible (GitHub Actions, ou Docker déjà disponible sur votre ordinateur) :

```bash
npm run db:up
npm run db:migrate
npm run validate:db
npm run sync:lyon:parking-rules -- --file data/lyon/roads.geojson --dry-run
npm run sync:lyon:parking-rules -- --file data/lyon/roads.geojson
npm run sync:lyon:facilities -- --file data/lyon/facilities.geojson --dry-run
npm run sync:lyon:facilities -- --file data/lyon/facilities.geojson
```

Sans `--file`, ces deux commandes interrogent les endpoints officiels bornés. Une réponse incomplète, un import vide ou une erreur de structure fait échouer la commande ; pas de désactivation sur une page partielle. `--dry-run` calcule inserted/updated/unchanged/deactivated/invalid dans une transaction READ ONLY ; aucune persistance. Rafraîchissement technique séparé du compteur updated métier.

Temps réel **uniquement après revue du mapping** :

```bash
npm run test:lyon:live
npm run sync:lyon:facilities -- --realtime
```

Le premier échec d'accès ou de schéma reste visible. Le mapping possède `id`, `available`, `updatedAt`, facultativement `occupied`, et `evidenceUrl` officiel ; les valeurs sont les noms de champs réellement constatés, pas ces libellés génériques. L'import statique et les observations ont des transactions séparées : si la persistance d'observations échoue, l'inventaire statique déjà importé reste valide et la commande échoue.

Exécution du service applicatif, après migration et synchronisation DiaLog/locales :

```bash
npm run check:parking -- "adresse précise à Lyon" "2026-09-07T14:00:00+02:00" "2026-09-07T16:00:00+02:00"
```

La sortie CLI est demandée explicitement, sans stockage de l'adresse. Sans places certifiées, le résultat de production reste UNKNOWN. Le modèle TypeScript permet de fournir VehicleProfile à CheckParkingService ; la CLI minimale n'en demande pas et n'invente donc aucun montant payant.

## Validation et GitHub

CI principale : migrations 001–004, tests SQL, intégrations antérieures et Lyon A–F, idempotence, proximité réelle, frontière/ambiguïté/coordonnées, disponibilité périmée, EXPLAIN et cible <500ms, puis TypeScript et toutes les unités. Les captures officielles réduites/completes sont locales ; aucun endpoint Lyon n'est appelé en CI principale.

Workflow manuel **Lyon live audit (manual)** : trois requêtes contrôlées (statique borné à 1 000 parkings, deux axes, deux observations). Indépendant de la CI principale. Le mapping peut être renseigné comme variable GitHub Actions de dépôt une fois vérifié. Les résultats réels sont séparés dans TEST_RESULTS.md.

**READY FOR PHASE 4: NO** — nouvelle CI PostGIS en attente, aucune place réelle certifiée, accès et mapping temps réel restant à valider.


## Correctif des intégrations Lyon

Voir ADR-049 et PHASE3_INTEGRATION_FIX.md. Le simple paiement donne désormais ALLOWED + PAID, sans condition réglementaire artificielle. Les fixtures DiaLog actives/futures sont cohérentes avant leur parsing. Les deux échéances sont présentes dans la décision et, lorsqu'elles existent, en haut du DTO. 257 unités réussies ; les 58 intégrations restent à relancer dans GitHub après le résultat précédent 54 réussites / 4 échecs.
