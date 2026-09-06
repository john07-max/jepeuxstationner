# Correctif ciblé — quatre intégrations Lyon

## Cause exacte

Les quatre échecs ont la même origine dans la fixture du test, avant la composition du moteur. Le XML DiaLog d'origine expirait le **05/09/2026 à 18:00Z**. Le helper Lyon l'analysait avec une récupération au **07/09/2026 à 12:00Z** : le parseur calculait donc correctement `active=false`. Puis le helper réécrivait début, fin et géométrie, en conservant ce statut inactif. Le filtre SQL `WHERE ... active ...` excluait cette restriction.

C/F/end-to-end ne recevaient que la permission locale payante, anciennement CONDITIONAL. D ne recevait aucune interdiction future : aucune échéance n'était donc calculée. Le service copiait déjà allowedUntil lorsqu'il existait. Le correctif ne force pas l'activation d'une règle expirée : il utilise deux XML Lyon cohérents, active/future, **avant** leur parsing. Les nouvelles préconditions prouvent aussi que la vraie requête PostGIS sélectionne effectivement une restriction.

## Autorisation, prix, priorité et échéances

- Paiement seul : **ALLOWED + PAID** sur couverture valide ; pas de condition d'autorisation artificielle. FREE reste indépendant également.
- Interdiction officielle spécifique : **FORBIDDEN**, même sur une permission générale ALLOWED. Cette priorité générique existait déjà et reste inchangée ; les contradictions spécifiques et règles de confiance UNKNOWN sont conservées.
- Prix d'une position documentée : PAID/FREE peut coexister avec FORBIDDEN ; le prix ne remplace pas la décision.
- Interdiction dans deux heures : CONDITIONAL, allowedUntil et mustLeaveBefore conservés dans ParkingDecision et exposés en haut du DTO. Les quatre valeurs sont testées.
- Fallback : déclenchement uniquement par decision.status===FORBIDDEN ; trois résultats attendus. Test unitaire réussi pour le déclenchement et le DTO ; contrôle réel des mètres et de l'ordre des trois parkings conservé dans l'intégration GitHub.

Le lundi payant est conservé comme scénario ; son assertion devient ALLOWED + PAID conformément à la demande. Aucun test n'est supprimé ou ignoré. Le moteur central, DiaLog, son fingerprint, les requêtes et les migrations ne sont pas modifiés.

## Validation réelle

| Contrôle | Résultat |
| --- | --- |
| npm ci | code 0 |
| npm run typecheck | code 0 |
| npm test | **257 réussis / 257**, 0 échec, 0 ignoré |
| npm run demo | code 0 |
| Rapport de couverture offline | code 0, inchangé |
| npm run test:integration | code 1, DATABASE_URL absente ; aucune intégration DB exécutée ici |
| npm run test:db | code 1, même précondition ; aucun SQL exécuté |
| db:wait/check/migrate/explain | code 1, aucune base disponible |

Huit nouveaux tests unitaires, 58 intégrations conservées. Total défini : **324 = 257 unités + 58 intégrations + 9 live**, hors assertions SQL. Aucun contrôle live relancé. La CI précédente, rapportée par l'utilisateur, était 54/58 ; la CI du correctif n'a pas encore été exécutée.

## Performance

**Temps réel du service après correction : non mesuré**, faute de PostgreSQL dans Work. La durée globale ~823ms rapportée n'isole pas le service des fixtures. Le seuil reste strictement 500ms.

Le chronomètre du service commence après l'import des fixtures, la génération des 20 000 lignes et ANALYZE. L'événement `lyon.offline.performance` sort désormais avant les assertions métier et contient `setupExcluded:true`. Le plan `lyon.nearby.plan` est récupéré avant l'assertion de durée, pour rester disponible même si celle-ci échoue. Aucun réglage ne force l'index. Aucune optimisation spéculative du setup ou modification du seuil.

## Installer et valider avec GitHub Desktop

1. Extraire **JePeuxStationner-phase3-integration-fix.zip** : il contient uniquement les fichiers ajoutés/modifiés.
2. Copier le contenu du dossier jepeuxstationner extrait dans votre dossier de dépôt actuel et accepter les remplacements. Conserver tous les autres fichiers, votre .git et votre .env.
3. GitHub Desktop : résumé « Fix Lyon integration fixtures and authorization », **Commit to main**, puis **Push origin**.
4. Actions : attendre **CI - PostGIS geocoding DiaLog Lyon**. Les tests sont découverts automatiquement ; aucune modification du workflow nécessaire.
5. Me renvoyer le lien d'exécution et l'archive **postgis-validation-…**, particulièrement integration.log avec le total attendu **58 réussites / 0 échec**, `lyon.offline.performance` et `lyon.nearby.plan`.

Si le service dépasse 500ms, le plan aidera à identifier le coût SQL avant de décider d'une optimisation. Aucun Docker/PostgreSQL n'a été installé dans Work.

## Fichiers modifiés

- `CHANGELOG.md`
- `DECISIONS.md`
- `DELIVERY_PHASE_3.md`
- `LYON.md`
- `PARKING_RULE_ENGINE.md`
- `README.md`
- `TEST_RESULTS.md`
- `packages/adapters/src/lyon/adapter.ts`
- `packages/application/src/check-parking.ts`
- `packages/domain/src/local-parking.ts`
- `tests/integration/lyon.test.ts`
- `tests/lyon-service.test.ts`
- `tests/lyon.test.ts`

## Fichiers ajoutés

- `docs/validation/phase3-fix-db-check.log`
- `docs/validation/phase3-fix-db-explain.log`
- `docs/validation/phase3-fix-db-migrate.log`
- `docs/validation/phase3-fix-db-wait.log`
- `docs/validation/phase3-fix-demo.log`
- `docs/validation/phase3-fix-lyon-coverage.log`
- `docs/validation/phase3-fix-npm-ci.log`
- `docs/validation/phase3-fix-results.json`
- `docs/validation/phase3-fix-test-db.log`
- `docs/validation/phase3-fix-test-integration.log`
- `docs/validation/phase3-fix-test.log`
- `docs/validation/phase3-fix-typecheck.log`
- `tests/fixtures/lyon/dialog-active.xml`
- `tests/fixtures/lyon/dialog-future.xml`
- `tests/lyon-authorization.test.ts`
- `PHASE3_INTEGRATION_FIX.md`

Décision détaillée : ADR-049 dans DECISIONS.md. Les limites de couverture réelle et d’accès temps réel précédemment documentées restent valables.

READY FOR PHASE 4: NO
Reason: Corrected PostgreSQL/PostGIS integrations and full GitHub CI pending; end-to-end runtime unmeasured.
