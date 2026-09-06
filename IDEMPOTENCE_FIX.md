# Correctif PHASE 2 : idempotence

Cause identifiée : JSON.stringify dépend de l'ordre des clés, alors que PostgreSQL JSONB le réorganise. Les timestamps étaient déjà partiellement exclus. L'upsert inconditionnel réécrivait en plus les champs métier. Référence : https://www.postgresql.org/docs/17/datatype-json.html

Correction : fingerprint SHA-256 sur champs métier explicites, tri récursif des clés ; dates d'application normalisées, coordonnées conservées sans permutation. Horodatages techniques exclus. Upsert métier uniquement si nécessaire ; mise à jour de fraîcheur séparée et conditionnelle. Aucun changement du moteur, du parser, des migrations ou de CI. Détails : ADR-037.

## Fichiers

Ajoutés : packages/database/src/dialog-fingerprint.ts, tests/dialog-fingerprint.test.ts et ce rapport.

Modifiés : packages/database/src/dialog.ts, tests/integration/dialog.test.ts, DECISIONS.md, DIALOG.md, TEST_RESULTS.md.

Six logs de validation ajoutés sous docs/validation/idempotence-*.log.

## Tests

Le test original est conservé. Les cinq cas demandés sont couverts par les tests d'intégration : identique, vraie modification de fin, récupération ultérieure, JSON réordonné, vraie modification de géométrie. Deux contrôles supplémentaires vérifient les colonnes écrites et la version xmin d'une ligne inchangée.

Résultat réel Work : TypeScript et 195 tests offline verts. Les commandes intégration/SQL/check/EXPLAIN échouent explicitement faute de DATABASE_URL, avant toute exécution PostgreSQL. 41 tests PostgreSQL sont définis mais non exécutés ici. Total des suites définies : 242, live compris. Aucun résultat CI du correctif n'est encore disponible.

## Appliquer avec GitHub Desktop

Cette archive contient seulement les fichiers du correctif. Copier le contenu de son dossier jepeuxstationner dans votre dépôt existant et accepter les remplacements. Conserver tous les autres fichiers.

Dans Desktop : Summary « Fix DiaLog idempotence », Commit to main, Push origin. Attendre le workflow CI principal dans Actions. Renvoyer son lien et integration.log (ou l'archive postgis-validation-…). Aucun changement de variable ni migration supplémentaire requis.

```bash
npm run typecheck
npm test
npm run test:integration
npm run test:db
npm run db:check
npm run db:explain
```

```text
READY FOR PHASE 3: NO
Reason: Idempotence PostgreSQL runtime validation and full GitHub CI pending.
```
