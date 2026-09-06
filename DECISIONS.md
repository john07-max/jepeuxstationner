# Décisions architecturales

Date : 2026-09-05. Toute évolution majeure doit ajouter une décision ici.

| ID | Décision | Motif / conséquence |
| --- | --- | --- |
| ADR-001 | Monorepo npm workspaces, ESM, Node 24, TypeScript strict | Socle minimal ; compilation unique, packages privés ; pas de framework web prématuré |
| ADR-002 | PostgreSQL 17 / PostGIS 3.5 via Compose, SQL natif | Modèle spatial explicite, GiST, intégrité relationnelle ; image de développement fixée à une branche, digest à verrouiller au déploiement |
| ADR-003 | Moteur pur et horloge injectée | Résultats reproductibles, aucune dépendance réseau ou base |
| ADR-004 | Couverture explicite et bornée par adapter | Absence de données ne signifie jamais autorisation |
| ADR-005 | Conflit entre effets officiels => UNKNOWN | Aucune hiérarchie juridique inventée ; officiel prévaut seulement sur secondaire |
| ADR-006 | Intervalles absolus [début, fin), découpage temporel | Tester le séjour complet et les transitions ; récurrences différées |
| ADR-007 | Défaillance de tout adapter configuré => UNKNOWN | Éviter une autorisation avec des sources manquantes ; politique volontairement restrictive |
| ADR-008 | Fixture unique, synthetic explicite | Ne pas présenter des simulations comme des règles réelles |
| ADR-009 | Aucune persistance des recherches | Minimisation des données ; traçabilité dans la réponse et les sources versionnées |
| ADR-010 | Démo CLI sans interface ni géocodage | Valider d'abord adapter → moteur ; HTTP et persistance applicative différés |
| ADR-011 | Refus d'une migration initiale rejouée | Transaction atomique et version explicite ; runner incrémental à ajouter avant migration 002 |

Dépendances connues avant implémentation : accès sources officielles et sélection de la ville pour la phase suivante ; Docker/PostGIS pour la validation SQL. Les exigences disponibles ne déterminent ni ville réelle, ni règle réelle, ni budget d'API.


## PHASE 0.5 — 2026-09-05

L'architecture de la PHASE 0 est conservée. Seules les adaptations nécessaires aux demandes de validation sont introduites.

| ID | Décision | Justification et conséquences |
| --- | --- | --- |
| ADR-012 | Réutiliser Compose dans GitHub Actions | Même PostgreSQL 17/PostGIS 3.5 ; healthcheck puis SELECT 1 authentifié et PostGIS_Version/pg_extension avant migration. Aucune installation système dans Work. |
| ADR-013 | Ajouter un pont de lecture SQL pour la validation | pg en dépendance de développement ; requêtes paramétrées → types du domaine → moteur inchangé dans son architecture. Ce pont n'est pas un fournisseur officiel de PHASE 1. |
| ADR-014 | Migration additive 002 pour règles permanentes | 001 reste intacte. Une règle peut avoir une borne supérieure absente, avec début effectif obligatoire. Le pont limite sa période à la requête ; la fraîcheur reste distincte et la couverture bornée. |
| ADR-015 | Corriger le statut agrégé du scénario B demandé | Remplace l'agrégation 0.0.1 : initialement permis puis interdit => CONDITIONAL avec mustLeaveBefore. Les segments interdits restent FORBIDDEN ; ce statut ne permet PAS de rester après l'échéance. Interdit dès le début => FORBIDDEN. Sinon un segment inconnu => UNKNOWN. Version moteur 0.0.2. |
| ADR-016 | Runner incrémental de migrations et reset protégé | Complète ADR-011 : le runner saute les versions déjà appliquées, verrouille les migrations et refuse un historique inattendu. Les fichiers SQL restent atomiques. db:reset supprime seulement les objets du projet sur localhost/127.0.0.1, base parking, avec opt-in local-disposable. |
| ADR-017 | Mesurer le plan sans imposer d'index | Fixture 40 000 zones, ANALYZE puis EXPLAIN ANALYZE BUFFERS ; vérifier l'existence du GiST et une correspondance, publier le plan réel et usesSpatialIndex. Pas de seuil de temps artificiel ni enable_seqscan=off. Un autre choix du planificateur est signalé pour examen. |
| ADR-018 | Barrière de passage PHASE 1 | Aucune validation PostGIS affirmée sur revue statique ou tests mémoire. READY FOR PHASE 1 reste NO tant que les preuves runtime GitHub n'ont pas été obtenues et examinées. |

Précision ADR-015 : pour un séjour prévu, « initialement » désigne le début de ParkingQuery, pas l'horloge d'évaluation. Si une permission générale et une interdiction officielle se chevauchent sans priorité documentée, le conflit reste UNKNOWN ; la fixture B représente des règles successives explicites. Aucun rang de priorité juridique n'a été inventé.


## PHASE 1 — 2026-09-05

| ID | Décision | Justification / limite |
| --- | --- | --- |
| ADR-019 | Commencer PHASE 1 sur confirmation utilisateur | Le brief joint confirme une CI PHASE 0/0.5 entièrement verte. Cette confirmation est distinguée d'une lecture indépendante des logs. La révision PHASE 1 reste à revalider sur GitHub. |
| ADR-020 | Ajouter un domaine de géocodage dans les packages existants | GeocodingProvider, types et erreurs indépendants ; aucun changement du moteur, du schéma, des migrations ou du fournisseur fictif. |
| ADR-021 | Géoplateforme search/reverse, index address | Contrat officiel actuel consulté ; autocomplete intégré via search avec 1, recherche via 0. API dépréciée refusée. Pas de Google Maps, DiaLog, données municipales ni règles réelles. |
| ADR-022 | Cache RAM borné et éphémère | 500 entrées LRU, TTL 24 h positif / 30 s vide, expiration même sans accès ; erreurs non cachées, aucune association IP/compte, aucun stockage sur disque ou PostgreSQL. |
| ADR-023 | Transport central avec débit partagé | 5/s par défaut par origine/processus, une nouvelle tentative au maximum par défaut, timeout 5 s couvrant le corps. 429 crée un cooldown Retry-After sans retry automatique. Pas de circuit breaker prématuré ; multi-processus à coordonner ultérieurement. |
| ADR-024 | Coordonnées nommées et géométrie validée | Interne latitude/longitude, GeoJSON et PostGIS longitude/latitude. Pas de permutation automatique de nombres mondialement valides ; résultats hors emprise filtrés, précision et score conservés sans inventer une certitude de stationnement. |
| ADR-025 | Debounce consommateur et live séparé | 300 ms, minimum 3 caractères, annulation et rejet des réponses obsolètes. Tests unitaires hors réseau inclus dans CI principale ; workflow live manuel à cinq requêtes et échec visible indépendant. |

Le filtre bounds privilégie le centre puis filtre au plus 50 candidats renvoyés ; il n'est pas exhaustif. Les filtres natifs depcode/citycode/city/postcode sont préférables quand disponibles. Aucun périmètre national n'est converti en couverture nationale du stationnement.

Les logs joints sous docs/validation sont des preuves d'exécution sur exemples publics ou fixtures synthétiques et sont explicitement versionnables. Cette exception au gitignore ne concerne aucun log de recherche utilisateur.

## PHASE 2 — 2026-09-05

| ID | Décision | Justification |
| --- | --- | --- |
| ADR-026 | Début PHASE 2 sur confirmation utilisateur | CI PHASE 1 verte selon le brief ; les nouveaux changements restent à revalider. |
| ADR-027 | Export DATEX 3 public actuel, endpoint fixe | Contrat officiel vérifié, trois filtres explicites ; aucune API de remplacement. |
| ADR-028 | SAX par arrêté, limites explicites | sax 1.6.1 ; flux réel 100 Mo ; DTD refusés, pas de copies nationales XML. Saxes archivé écarté. |
| ADR-029 | ImportedParkingRule et projection ParkingRule | Fin nullable persistée, règles du moteur toujours bornées ; pas de DATEX dans le moteur. |
| ADR-030 | Table additive imported_parking_rules | Géométries individuelles sans transformer les zones historiques ; data_sources réutilisée, migration 003, reset adapté à sa FK. |
| ADR-031 | Identité composée déterministe | UUID arrêté réel plus empreinte géométrie/début/conditions ; pas d'UUID sous-mesure dans l'export. End/description/status mis à jour, changement structurel crée une nouvelle version logique. |
| ADR-032 | Restrictions partielles et origine informative | purpose=RESTRICTIONS ne prétend pas à la couverture ; une preuve peut interdire mais jamais autoriser. Scénario B nécessite une permission indépendante explicite. Alias allowedUntil conservant mustLeaveBefore. |
| ADR-033 | 5 m configurables, ST_DWithin geography | Maximum 15 m ; ST_Covers pour surfaces ; ne garantit pas le côté de rue. Découpage explicite MultiLineString/MultiPoint/collections. |
| ADR-034 | Récurrences et véhicules non évalués | Métadonnées conservées, supported=false conduit à UNKNOWN ; aucune généralisation d'une exception. |
| ADR-035 | Import atomique et dry-run READ ONLY | Advisory lock, clé unique, upsert, désactivation logique ; toute erreur tolérée bloque les désactivations, seuil 1 % sinon rollback. |
| ADR-036 | Fraîcheur récupérée et contrôles séparés | Défaut 24 h ; pas de sourceUpdatedAt fabriquée. XML live manuel, fixtures offline en CI principale et vrai PostgreSQL uniquement sur GitHub. |

Les modèles et choix détaillés, notamment les limites d'identité et le scénario B, sont dans DIALOG.md. Le moteur passe à 0.0.3 pour ces changements ciblés ; les tests des décisions antérieures restent inchangés. Aucune PHASE 3 commencée.

## ADR-037 — correction ciblée d'idempotence — 2026-09-06

Cause : comparaison JSON.stringify d'objets relus depuis JSONB, dont l'ordre des propriétés n'est pas conservé. Les dates observedAt/retrievedAt/freshUntil étaient déjà exclues ; cela ne corrigeait pas l'ordre des clés. L'upsert était aussi inconditionnel, même quand le compteur métier valait zéro.

Fingerprint SHA-256 sur une liste explicite de champs métier : identités, effet, conditions, géométrie, dates d'application normalisées UTC, permanent/active/supported, limitations, récurrences, véhicules, référence/description et provenance fonctionnelle (référence, version, autorité, valeur juridique, notice, indicateur synthétique). Tri récursif des propriétés, y compris dans les sous-conditions JSON sérialisées. Ordre des tableaux conservé, notamment coordonnées : aucune équivalence topologique supposée. present est comparé séparément ; une réactivation compte comme modification.

Exclusion des dates d'observation/récupération/fraîcheur et sourceUpdatedAt, purement informative dans le modèle actuel. Les nouveaux champs ne deviennent pas implicitement métier : étendre la liste explicitement s'ils influencent les règles. Aucun changement de clé externe ni migration.

Si le fingerprint diffère ou la ligne est absente/désactivée, upsert métier et compteur correspondant. Sinon, UPDATE limité à retrieved_at et aux quatre métadonnées de fraîcheur sous normalized.source, seulement si distinctes ; aucun changement de géométrie, période, statut ou données métier. Avec les mêmes timestamps, aucune écriture de ligne de règle. Le rafraîchissement de data_sources reste indépendant et ne compte pas comme updated. La transaction, le verrou, le dry-run et les règles de désactivation sont conservés.

Tests : huit nouveaux tests offline et quatre nouveaux tests PostgreSQL ; test d'idempotence original et test de modification de fin conservés. Le test PostgreSQL utilise aussi un trigger de contrôle des colonnes métier et xmin pour vérifier l'absence réelle d'écriture sur une règle identique. Validation runtime en attente de CI.

## PHASE 3 — pilote Lyon — 2026-09-06

L'utilisateur confirme la CI PHASE 2 verte dans le dernier cahier des charges et autorise PHASE 3. Aucun changement PHASE 4. L'audit préalable est conservé dans LYON_AUDIT.md.

| ID | Décision | Justification |
| --- | --- | --- |
| ADR-038 | Conserver le monorepo, ajouter application et modules Lyon | Domaine, adaptateurs, base, moteur existants conservés. CheckParkingService orchestre géocodage, couverture, DiaLog, prix et trois parkings. Aucune adresse enregistrée. |
| ADR-039 | Couverture positive de place distincte du rapprochement d'axe | Art. 9 autorise les emplacements tracés. Migration 004 ajoute inventaire de rues, places vérifiées liées aux zones existantes, registre local et parkings. Une correspondance de nom n'insère jamais une place vérifiée. Aucune géométrie de place ni limite administrative de Lyon n'est inventée. |
| ADR-040 | Extraction textuelle contrôlée de l'annexe | pdfplumber 0.11.8, tolérance horizontale 0.5, SHA256 et page par entrée ; 1 142 identités uniques pages 1–62. Les pages 63–66 ont une table différente et répètent des voies du 5e : quarantainées. Pas d'OCR ni parsing HTML à chaque demande. |
| ADR-041 | Rapprochement nom + arrondissement + identité officielle codefuv | Accents, apostrophes, traits d'union et types normalisés ; plusieurs tronçons d'un codefuv sont réunis, plusieurs identités restent ambiguës. Voies partielles, extensions futures et NOCTURNE non éligibles. Rapport mesuré sur 7 964 tronçons officiels. |
| ADR-042 | Priorité générique limitée des interdictions spécifiques | Ajout optionnel ParkingRule.scope=GENERAL. Une interdiction officielle spécifique écarte seulement les permissions générales explicitement marquées. Les autres conflits officiels restent UNKNOWN. Le moteur 0.0.4 ne connaît ni Lyon ni UNO ; le correctif d'idempotence DiaLog reste intact. |
| ADR-043 | Prix séparés et règles visiteurs UNO versionnées | Trois classes énergie/masse, paliers publiés uniquement, aucun prix interpolé ni masse supposée. FREE/PAID concerne l'instant initial ; amount éventuel la période évaluée. Plafond pris en charge : 24h de séjour et au plus 600 minutes payantes. Au-delà UNKNOWN, pas de déduction de permission illimitée. |
| ADR-044 | Calendrier France calculé en Europe/Paris | date-holidays version verrouillée, jours public uniquement, DST testé. Exceptions datées sourcées et éligibilité explicite ; mécanisme testé mais aucun avantage résident/artisan activé automatiquement. Août reste payant pour le visiteur. |
| ADR-045 | Trois fraîcheurs indépendantes | Règle éditoriale revue avant 06/10/2026 ; axes maximum 7 jours ; disponibilités 180 s par défaut, 60–900 configurables. La lecture d'un fichier archivé ne renouvelle pas sa date de collecte. Les horodatages futurs ou incohérents ne créent pas une information fraîche. |
| ADR-046 | Parkings statiques réels, temps réel sans champs devinés | WFS statique accessible : 189 parkings, 32 explicitement tous publics, 126 capacités négatives (-1) converties en inconnues. Les autres accès ne sont pas proposés automatiquement. Aucun horaire déduit du champ texte info. WFS temps réel HTTP 401 dans Work : mapping explicite revu requis, import optionnel --realtime, aucun chiffre fictif de production. |
| ADR-047 | Idempotence locale et observation séparées | Comparaison canonique des champs métier/coordonnées, clé source+externalId pour parkings ; dates techniques exclues, fraîcheur rafraîchie séparément. Axes comparés après tri des tronçons par identité. Désactivation sur inventaire complet seulement, import vide/tronqué/structure invalide rejeté, rollback. Les observations temps réel sont indépendantes, ne modifient pas updated métier, et les plus anciennes sont ignorées. dry-run transaction READ ONLY. |
| ADR-048 | Vrai PostGIS uniquement en CI | Les tests Lyon A–F, import, proximité, métrique <500ms et EXPLAIN ANALYZE sont préparés sur schéma privé isolé. Aucun PostgreSQL/Docker installé dans Work. Le workflow principal n'appelle aucun endpoint métier ; audit live manuel séparé. Pas de READY PHASE 4 avant CI verte, couverture de places réelle et temps réel vérifié. |

Les valeurs -1 du flux statique sont des capacités inutilisables, conservées comme absence de capacité et jamais comme zéro. Les 189 enregistrements restent traçables. `invalid=0` dans un import réussi signifie validation stricte préalable ; une erreur structurelle lève une erreur et fait échouer la commande, elle n'est pas masquée par un compteur de succès.
