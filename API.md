# API applicative — PHASE 4

Node.js 24, même origine que le navigateur. `apps/web/server/start.ts` relie les routes au service Lyon existant via un pool PostgreSQL. Aucun DTO fournisseur brut ni accès SQL dans React.

| Méthode | Route | Réponse |
|---|---|---|
| POST | `/api/parking/check` | `ParkingCheckResult` du domaine |
| GET | `/api/geocoding/autocomplete?q=...` | `{suggestions: GeocodingResult[]}` (5 maximum) |
| GET | `/api/geocoding/reverse?latitude=...&longitude=...` | `{location: GeocodingResult \| null}` |
| GET | `/api/health` | `{status:"ok"}` si le serveur répond |
| GET | `/api/ready` | 200 si `SELECT 1` réussit, sinon 503 ; aucun appel public |

Exemple de corps (adapter les dates à la période actuelle) :

```json
{"latitude":45.76,"longitude":4.83,"start":"2026-09-07T12:00:00Z","end":"2026-09-07T16:00:00Z","vehicle":{"vehicleType":"CAR","energy":"THERMAL","weightKg":1350}}
```

`vehicle` est facultatif. `vehicleType`: CAR/OTHER ; `energy`: THERMAL/PLUGIN_HYBRID/ELECTRIC ; `weightKg`: nombre >0 et ≤10000. Coordonnées numériques, latitude ±90 et longitude ±180, dates ISO avec décalage, fin strictement postérieure, durée ≤24 h, début entre maintenant −5 minutes et +7 jours. Champs inconnus refusés. Pas de conversion implicite des chaînes numériques POST. JSON limité à 8 Kio.

Le statut d'autorisation est `decision.status`, indépendant de `pricing.status`. `allowedUntil` et `mustLeaveBefore` sont conservés dans le DTO et dans la décision. `UNKNOWN` métier est HTTP 200. Une dépendance indispensable défaillante est HTTP 503 : aucun résultat rassurant ne la remplace. L'indisponibilité des parkings facultatifs conserve la décision et donne une liste vide.

Erreurs structurées : `{"error":{"code":"INVALID_INPUT","message":"…"}}`. 400 entrée invalide, 403 origine refusée, 413 corps trop grand, 415 type non JSON, 422 OUTSIDE_CITY, 429 RATE_LIMITED avec Retry-After:60, 503 SERVICE_UNAVAILABLE. Un périmètre Lyon absent en base est une panne de configuration (503), pas un périmètre inventé.

Autocomplete : minimum 3 caractères, maximum 200 ; provider existant uniquement. Le reverse n'ajuste jamais la position GPS soumise au moteur.

Sécurité : limites par adresse réseau du socket et groupe de routes (20 checks/minute, 60 géocodages/minute), mémoire bornée à 10 000 entrées, expiration 60 s. X-Forwarded-For n'est pas accepté aveuglément. Derrière proxy, cette limite est partagée par les clients du proxy : prévoir une limite réseau au frontal pour une ouverture publique, sans affaiblir celle-ci. Same-origin, pas de CORS permissif, no-store pour les réponses API, CSP, anti-framing, nosniff, no-referrer. Pool de 8 connexions, connexion et statement timeout 2 s, réponse API bornée à 10 s et client à 12 s.

Aucun cache de décision finale : les échéances, arrêtés et fraîcheurs sont réévalués. Le cache géocodage existant demeure borné en RAM (voir GEOCODING.md). Logs : événement, code HTTP, durée, ville ; jamais requête, adresse, GPS, IP, corps ou pile d'erreur. Aucun nouveau schéma SQL requis.
