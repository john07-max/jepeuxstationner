# Livraison PHASE 4 — API et première interface mobile

1. **Fonctionnel** : recherche d'adresse ou position GPS volontaire, durée, décision, tarif distinct, sources, alternatives et carte optionnelle. Basé sur les services métier existants. Aucun déploiement ni PHASE 5.
2. **Structure** : apps/web/server (validation, routes, serveur et entrée production), apps/web/src (App, client, temps, carte, styles), apps/web/public (axes locaux), tests/api, tests/web-time, tests/e2e, tests/support. Liste exhaustive des ajouts/modifications ci-dessous.
3. **Endpoints** : POST /api/parking/check ; GET /api/geocoding/autocomplete, /api/geocoding/reverse, /api/health, /api/ready. Contrat complet dans API.md.
4. **Composants** : App (formulaire, décisions, tarifs, parkings, détails), InfoPage (sources/confidentialité/mentions), ParkingMap (chargement différé) ; helpers API/temps sans métier dupliqué.
5. **Parcours** : sélectionner une adresse → durée → Vérifier. Saisie/clavier/GPS, états de chargement et erreurs explicites. Modifier l'entrée invalide l'ancien résultat.
6. **ALLOWED** : OUI, paiement éventuel dans un bloc séparé.
7. **CONDITIONAL** : OUI, MAIS… et heure limite visible ; allowedUntil/mustLeaveBefore conservés.
8. **FORBIDDEN** : NON, jamais remplacé par un simple statut payant.
9. **UNKNOWN** : INFORMATION INSUFFISANTE, aucune autorisation implicite ; panne technique distinguée en HTTP 503.
10. **Pricing** : FREE/PAID/UNKNOWN ; aucun montant inventé. Règles et priorités antérieures conservées.
11. **Parkings** : trois maximum pour FORBIDDEN/UNKNOWN, tri conservé depuis le service/PostGIS, disponibilité seulement fraîche, lien de destination volontaire.
12. **GPS** : clic obligatoire, timeout/refus gérés, coordonnées exactes conservées malgré le reverse.
13. **Sécurité** : validation stricte, 8 Kio, 24 h, timeout, rate limiting borné, same-origin, CSP et en-têtes. Pool PostgreSQL de 8 connexions ; voir API.md.
14. **Privacy** : aucun historique précis, log de position, cookie ou analytics externe. Carte locale. Contrôle des logs d'hébergement documenté dans PRIVACY.md et DEPLOYMENT.md.
15. **Tests ajoutés** : 61 (39 locaux, 1 intégration réelle, 21 navigateur).
16. **Total** : 376 tests JS/TS inventoriés, plus assertions SQL. **296/296 réellement réussis localement** ; 59 intégrations et 21 scénarios navigateur restent à valider en CI.
17. **CI** : précédente PHASE 3 annoncée verte par l'utilisateur ; nouvelle PHASE 4 non exécutée sur GitHub depuis Work. Toutes les étapes bloquantes sont conservées, logs et captures archivés même en échec.
18. **Build** : production réussi ; JS initial 67,32 ko gzip. MapLibre chargé au clic, 258,13 ko gzip supplémentaires et GeoJSON local. Avertissement de gros chunk documenté, aucun seuil artificiellement augmenté.
19. **Visuel** : capture réelle docs/validation/phase4-forbidden.jpg. Parcours manuel NON + PAID + trois alternatives confirmé dans le navigateur. Contrôles mobiles automatisés et carte finale non validés ici.
20. **Limites** : PostgreSQL absent ; téléchargement Chromium expiré ; aucune performance DB/API mesurée ; CI à lancer. Données de couverture réelle et temps réel conservent les limites d'audit précédentes. Mentions légales à compléter avant ouverture publique.
21. **Lancement** : Node 24, `npm ci`, `npm run validate`, puis `npm run demo:web` pour les fixtures ; vraie base configurée puis `npm run db:migrate`, `npm run build`, `npm start` pour l'entrée réelle. Tous les détails dans DEPLOYMENT.md.

## Structure exacte du workflow

Checkout → Node 24 → dossier logs → npm ci → db:up (Compose PG17/PostGIS3.5) → db:wait → db:check → db:migrate → rejeu migrations → test:db → test:integration → db:explain → typecheck → npm test → lyon:coverage hors réseau → demo → build production → installation Chromium → test:e2e → collecte des logs (toujours) → upload artifact (toujours) → arrêt de la base jetable (toujours).

Déclencheurs push, pull_request et workflow_dispatch. Ubuntu 24.04, timeout 25 min, permissions contents:read. Shell bash GitHub avec pipefail : une commande en échec ne devient pas un succès grâce à tee. Aucun continue-on-error. Identifiants DB jetables de CI définis dans le workflow, aucun secret de production.

## Envoyer la livraison à GitHub

Copier le contenu du dossier `jepeuxstationner` du ZIP dans votre dossier existant → GitHub Desktop → Commit → Push origin → GitHub Actions → attendre toutes les étapes vertes. Ne pas remplacer votre configuration .env. Renvoyer l'URL du run et l'archive postgis-validation avec les logs d'intégration, EXPLAIN, build, E2E et les captures. Aucun nouveau repository nécessaire.

## Fichiers ajoutés et modifiés

Comparaison avec la livraison PHASE 3 et son correctif d’intégration.

### Ajoutés

- `API.md`
- `DELIVERY_PHASE_4.md`
- `DEPLOYMENT.md`
- `UI.md`
- `apps/web/index.html`
- `apps/web/package.json`
- `apps/web/public/lyon-map.geojson`
- `apps/web/server/api.ts`
- `apps/web/server/server.ts`
- `apps/web/server/start.ts`
- `apps/web/server/validation.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/ParkingMap.tsx`
- `apps/web/src/client.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/style.css`
- `apps/web/src/time.ts`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `docs/validation/PHASE_3_RESULTS_ARCHIVE.md`
- `docs/validation/phase4-build.log`
- `docs/validation/phase4-command-exits.json`
- `docs/validation/phase4-coverage.log`
- `docs/validation/phase4-db-check.log`
- `docs/validation/phase4-db-explain.log`
- `docs/validation/phase4-db.log`
- `docs/validation/phase4-demo.log`
- `docs/validation/phase4-e2e.log`
- `docs/validation/phase4-forbidden.jpg`
- `docs/validation/phase4-integration.log`
- `docs/validation/phase4-npm-ci.log`
- `docs/validation/phase4-typecheck.log`
- `docs/validation/phase4-unit.log`
- `playwright.config.ts`
- `scripts/dev-web.mjs`
- `tests/api.test.ts`
- `tests/e2e/parking.spec.ts`
- `tests/support/web-demo.ts`
- `tests/web-time.test.ts`
- `tsconfig.e2e.json`

### Modifiés

- `.env.example`
- `.github/workflows/ci.yml`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `PRIVACY.md`
- `README.md`
- `TEST_RESULTS.md`
- `package-lock.json`
- `package.json`
- `packages/application/src/check-parking.ts`
- `packages/application/src/lyon.ts`
- `packages/database/src/dialog.ts`
- `packages/database/src/lyon.ts`
- `packages/domain/src/local-parking.ts`
- `tests/integration/lyon.test.ts`
- `tsconfig.json`

READY FOR PHASE 5: NO

Raison : CI PHASE 4, PostgreSQL/PostGIS, performance API réelle et suite navigateur automatisée en attente de validation.
