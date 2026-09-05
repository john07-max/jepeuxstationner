# Vie privée

Aucune adresse utilisateur, compte, IP ou historique de recherche n'est conservé. Le schéma ne contient pas de table de recherches. La requête du moteur contient une zone normalisée, sans adresse brute ; la décision ne réémet pas la requête. La démo affiche uniquement des données fictives.

Les références des sources peuvent désigner un emplacement réglementaire public ; elles ne doivent pas inclure une recherche privée. Les erreurs d'adapter sont réduites à ADAPTER_FAILURE sans texte d'exception.

Phase suivante : traiter l'adresse et les coordonnées uniquement en mémoire, expurger les journaux HTTP et traces, ne pas mettre l'adresse dans les URL ou analytics, définir une rétention minimale avant tout stockage. Les sources réglementaires sont persistantes ; les requêtes personnelles ne le sont pas par défaut. Les secrets .env sont exclus de git et la base de développement n'écoute que sur 127.0.0.1.


## PHASE 1 — géocodage et cache technique

Aucun historique, table, fichier ou journal de recherches n'est créé. Le cache technique conserve au maximum 500 requêtes normalisées et leurs résultats en mémoire du processus, pendant 24 h au maximum par défaut (30 s pour les réponses vides), avec timers d'expiration et éviction LRU. Le TTL est configurable, zéro désactive le stockage ; les erreurs ne sont pas cachées.

Une adresse ou des coordonnées sont nécessairement transmises au service officiel pour réaliser l'opération demandée. Elles ne sont accompagnées d'aucun identifiant de compte, IP utilisateur ajoutée par l'application, ni cookie applicatif. Le fournisseur réseau peut observer l'IP de sortie du serveur ; aucune promesse d'anonymat réseau n'est faite. Le code ne conserve aucune association adresse + IP + user ID.

Le transport ne journalise ni URL de recherche, ni corps HTTP, ni erreur réseau brute. Les erreurs publiques portent des codes techniques. La CLI affiche uniquement le résultat explicitement demandé par son opérateur. Le provider/cache s'exécute côté serveur et un futur proxy applicatif devra également éviter les logs de paramètres sensibles.
