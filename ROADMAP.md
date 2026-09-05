# Feuille de route

- Phase 0 livrée : monorepo, TypeScript strict, modèle SQL PostGIS, contrat adapter, moteur, fixture, tests mémoire et documentation.
- PHASE 0.5 préparée : CI PostGIS, tests SQL étendus, intégration DB → moteur et mesure du plan spatial ; runtime en attente.
- Porte de validation restante : exécuter la migration et les tests SQL sur PostgreSQL/PostGIS (ou CI), puis examiner le résultat.
- Phase 1 : choisir une seule ville après inventaire officiel, documenter licence/fraîcheur/exhaustivité et limites de géocodage/côté. Définir les vrais cas d'acceptation.
- Phase 2 : adapter PostgreSQL et ingestion officielle validée, historisation, normalisation des récurrences et tests de changements d'heure. Les APIs restent non connectées tant que cette étape n'est pas engagée.
- Phase 3 : API serveur, résolution d'adresse/zone avec ambiguïtés explicites, tests HTTP et confidentialité des logs.
- Phase 4 : interface mobile-first (adresse, période, décision, sources, UNKNOWN lisible), accessibilité, tests de bout en bout.
- Phase 5 : contrôle qualité dans une ville, observabilité sans adresses précises, sauvegarde/restauration et déploiement. Extension géographique seulement après cette validation.

Le dépôt livré est un socle de développement, pas une application prête à conseiller un conducteur.


Statut de livraison PHASE 0.5 :

```text
READY FOR PHASE 1: NO
Reason: PostgreSQL/PostGIS runtime validation pending.
```

Ne pas commencer l'inventaire ou la connexion d'une source réelle dans ce lot. Attendre les logs de la CI et corriger les éventuels échecs avant tout passage à la PHASE 1.
