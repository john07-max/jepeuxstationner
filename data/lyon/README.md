# Captures officielles Lyon — 6 septembre 2026

Attribution : **Métropole de Lyon**, données WFS trame viaire et parkings opérateurs, Licence Ouverte 2.0 d'après les métadonnées du producteur ; traitements JePeuxStationner. URLs exactes et licences dans sources.json, empreintes dans manifest.json. Les captures sont publiques ; aucune recherche utilisateur n'est incluse.

- roads.geojson : 7 964 tronçons, requête WFS filtrée nomcommune LIKE Lyon%, count=10000 ; numberMatched=numberReturned, EPSG:4326.
- facilities.geojson : 189 parkings, count=1000 ; capture statique, aucune disponibilité temps réel.
- streets.json : extraction déterministe du texte de l'annexe 1, arrêté municipal 2026RP48956. Référence PDF, SHA256, pages et valeurs textuelles conservés. Texte administratif public ; aucune licence spécifique affirmée. Pages 63–66 quarantainées.
- coverage-report.json : rapprochement mesuré ; 96,58 % des axes et zéro place certifiée. Ne pas utiliser ce pourcentage comme probabilité d'autorisation.

Les timeStamp des captures WFS gardent l'instant fourni par le serveur. Réimporter ces fichiers ne les rend pas frais aujourd'hui. Les preuves éditoriales ont une précision au jour. Pour toute mise à jour : vérifier source, licence et schéma, refaire l'extraction/rapprochement et actualiser le manifeste après revue. Le pilote refuse une capture structurée tronquée.
