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
