# Vie privée

Aucune adresse utilisateur, compte, IP ou historique de recherche n'est conservé. Le schéma ne contient pas de table de recherches. La requête du moteur contient une zone normalisée, sans adresse brute ; la décision ne réémet pas la requête. La démo affiche uniquement des données fictives.

Les références des sources peuvent désigner un emplacement réglementaire public ; elles ne doivent pas inclure une recherche privée. Les erreurs d'adapter sont réduites à ADAPTER_FAILURE sans texte d'exception.

Phase suivante : traiter l'adresse et les coordonnées uniquement en mémoire, expurger les journaux HTTP et traces, ne pas mettre l'adresse dans les URL ou analytics, définir une rétention minimale avant tout stockage. Les sources réglementaires sont persistantes ; les requêtes personnelles ne le sont pas par défaut. Les secrets .env sont exclus de git et la base de développement n'écoute que sur 127.0.0.1.
