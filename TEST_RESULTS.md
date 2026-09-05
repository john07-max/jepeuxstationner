# Résultats PHASE 1 — géocodage français

## Précondition PHASE 0/0.5

Le brief joint par l'utilisateur confirme que les PHASES 0/0.5 sont validées et que leur CI PostgreSQL/PostGIS est entièrement verte. Cette confirmation autorise la PHASE 1. Aucun log de cette exécution GitHub n'a été analysé indépendamment dans ce tour. Le compte rendu Work initial est conservé dans docs/validation/PHASE_0_5_WORK_RESULTS.md.

## TESTS EXÉCUTÉS DANS L'ENVIRONNEMENT WORK

| Commande / vérification | Résultat observé |
| --- | --- |
| npm ci | Code 0, installation via lockfile existant, aucune dépendance ajoutée |
| npm run typecheck | Code 0, TypeScript strict |
| npm test | Code 0, **143 réussis / 143**, 0 échec, 0 ignoré |
| npm run demo | Code 0, démonstration de stationnement fictive conservée |
| Comparaison du moteur, schéma, migrations, tests DB, lockfile, tsconfig | Inchangés par rapport à PHASE 0.5 |
| Parsing YAML des workflows | Réussi ; CI principale identique hors libellé d'étape |

Les 143 tests hors réseau comprennent les 50 tests existants et **93 nouveaux tests géocodage**. Ils couvrent recherche, autocomplétion, reverse, validation des réponses et coordonnées, normalisation, cache TTL/LRU, absence de cache d'erreurs, isolation des valeurs, timeout y compris corps lent, retries bornés, 429/Retry-After, débit partagé, annulations et réponses obsolètes.

Les huit garde-fous de scripts DB existants ne se connectent pas à PostgreSQL. Aucun test SQL/PostGIS n'a été exécuté dans Work pendant cette phase ; aucune installation Docker/PostgreSQL n'a été tentée.

Logs locaux : docs/validation/phase1-npm-ci.log, phase1-typecheck.log, phase1-unit-tests.log, phase1-parking-demo.log. Les noms de tests mentionnent uniquement des exemples publics ou des fixtures synthétiques, pas un historique de recherches utilisateur.

## TESTS LIVE RÉELLEMENT EXÉCUTÉS

Commande `npm run test:geocoding:live`, cinq requêtes officielles, sans mock, aucun retry, timeout 10 s par requête. **Résultat : 3 succès, 2 échecs, code de sortie 1.**

| Cas | Résultat |
| --- | --- |
| Recherche Paris, 1 Place de l'Hôtel de Ville | TIMEOUT après environ 10 s |
| Recherche Lyon, Place Bellecour | Réussi ; résultat normalisé et coordonnées dans l'emprise de Lyon |
| Recherche Nantes, 44000 Nantes | TIMEOUT après environ 10 s |
| Reverse Paris, 48.8566 / 2.3522 | Réussi ; résultat normalisé et coordonnées dans l'emprise de Paris |
| Autocomplétion Lyon, 12 rue vict | Réussi ; résultat normalisé, limite et emprise respectées |

La suite live n'a pas été rejouée répétitivement pour obtenir du vert. Les timeouts peuvent dépendre du chemin réseau de Work, du proxy ou du fournisseur ; leur cause exacte n'a pas été établie. Ils ne sont ni masqués ni convertis en réponses vides. Logs : docs/validation/phase1-geocoding-live.log.

La commande `npm run demo:geocode -- "10 rue de la Paix Paris"` a aussi été exécutée réellement : compilation réussie, puis code 1 avec message typé TIMEOUT (configuration par défaut 5 s par tentative, retry limité). Aucun résultat d'adresse n'est fabriqué. Log : docs/validation/phase1-geocode-cli.log.

93 tests hors réseau et 5 tests live ont été ajoutés, soit 98 tests définis supplémentaires. Les réussites live restent séparées des 143 tests hors réseau ; il n'est pas affirmé que les 148 tests exécutés sont tous verts.

## CONTRÔLES GITHUB ACTIONS RESTANT À EXÉCUTER SUR CETTE RÉVISION

- Workflow principal : PostgreSQL/PostGIS, migrations, assertions SQL, 19 tests DB → moteur, EXPLAIN, TypeScript et 143 tests hors réseau.
- Workflow manuel Geocoding live : refaire les cinq contrôles officiels depuis le runner GitHub et examiner leur résultat.
- Télécharger les artefacts et comparer les résultats à cette livraison.

Les étapes du workflow principal sont conservées ; seul le libellé de l'étape Unit tests précise qu'elle inclut le géocodage hors réseau. Cela préserve sa définition mais ne constitue pas une preuve de réussite runtime de la nouvelle révision.

## Statut

```text
READY FOR PHASE 2: NO
Reason: Current revision CI revalidation pending; live geocoding suite has two timeouts.
```

La PHASE 1 est implémentée et testée hors réseau, mais sa validation complète n'est pas revendiquée. Aucune PHASE 2 commencée.
