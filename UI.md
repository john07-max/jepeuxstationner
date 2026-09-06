# Interface mobile — PHASE 4

React/TypeScript strict avec Vite ; système visuel clair, fond bleu pâle, cartes blanches, typographie système, accent vert sombre et pictogramme P. Marque « JePeuxStationner », slogan « Une adresse. Une heure. Une réponse. », mention Bêta Lyon. Deux colonnes sur ordinateur, une sur mobile, contrôles ≥44 px.

Parcours : saisir au moins trois caractères → choisir une suggestion → choisir une durée → vérifier. Debounce 300 ms, annulation des recherches obsolètes, flèches/Entrée/Échap, bouton désactivé avant sélection. La modification de l'adresse ou de la période invalide la réponse précédente. Le résultat reçoit le focus ; les erreurs ne sont pas interprétées comme UNKNOWN.

Durées : 1/2/4 h écoulées ; « Cette nuit » jusqu'au prochain 08:00 Paris ; « Demain matin » jusqu'à 10:00 le jour calendaire suivant ; personnalisé avec heure locale Paris. La date et l'heure exactes sont affichées. Une période dépassant 24 h est refusée et invite à choisir une fin plus proche. Les heures ambiguës/inexistantes de changement d'heure sont refusées, pas devinées.

| Autorisation | Affichage |
|---|---|
| ALLOWED | OUI et détails |
| CONDITIONAL | OUI, MAIS… et heure limite visible lorsqu'elle existe |
| FORBIDDEN | NON et jusqu'à trois alternatives |
| UNKNOWN | INFORMATION INSUFFISANTE, vérifier la signalisation, alternatives si disponibles |

La tarification FREE/PAID/UNKNOWN possède son bloc distinct. Aucun prix inventé. Une observation de disponibilité périmée n'est jamais affichée comme un nombre actuel. Aucun horaire d'ouverture n'est inventé. Les itinéraires externes ne transmettent que la destination à l'ouverture volontaire du lien.

GPS : permission uniquement après clic, 8 s maximum, refus/indisponibilité expliqués, précision >30 m refusée, saisie manuelle toujours disponible. Le reverse fournit un libellé mais ne déplace pas les coordonnées GPS.

Carte MapLibre importée seulement sur clic après le résultat textuel. Routes locales de la Métropole, attribution Licence Ouverte 2.0, point et parkings. Ni tuiles, ni polices externes. Les axes ne représentent pas des places certifiées. Échec de chargement du module ou WebGL : texte conservé. Pas de carte bloquante au démarrage.

Pages `/sources`, `/confidentialite`, `/mentions-legales`. Les informations d'éditeur inconnues restent à compléter. Données fictives explicitement signalées dans les résultats documentés de la démo. Aucun compte, publicité, suivi externe ou PHASE 5.

Tests navigateur préparés : états, deadline, clavier, GPS accordé/refusé, invalidation, erreurs, carte et panne de carte, pages d'information, six largeurs 320/375/390/430/768/1280 px. Les contrôles manuels réels et limites d'exécution sont recensés dans TEST_RESULTS.md.
