# Checklist de vérification sur appareil

À dérouler sur un iPhone réel et un Android réel à chaque jalon.

## M1 — Socle
- [ ] L'app s'installe depuis le build `development` et s'ouvre sans écran rouge.
- [ ] Polices : titres en Barlow Condensed (condensé, très gras), texte en DM Sans.
- [ ] Zones de sécurité : rien sous l'encoche / la Dynamic Island ni sous la barre d'accueil.
- [ ] « Charger le programme exemple » → la séance du jour s'affiche.
- [ ] Pilules des jours : tap sur chaque jour, jours sans séance atténués mais cliquables.
- [ ] Profil : FR/EN et Sombre/Clair/Système s'appliquent immédiatement.
- [ ] Mode Système : changer le mode sombre du téléphone met l'app à jour.
- [ ] Tuer l'app puis la rouvrir : programme, langue et thème sont conservés.

## M1 — Web (npx expo start --web)
- [ ] Premier lancement : « PAS DE PROGRAMME » + bouton « CHARGER LE PROGRAMME EXEMPLE ».
- [ ] Après le tap : Today affiche le jour courant (séance ou REPOS), 7 pilules avec un point sur aujourd'hui.
- [ ] Tap sur LUN : « FULL BODY » en doré + liste des exercices ; tap sur MAR : « REPOS ».
- [ ] Profil → EN : libellés des onglets en anglais ; Clair : fond crème #f4f1ec.
- [ ] Recharger la page : langue, thème et programme conservés ; aucune erreur SQLite dans la console.

## M2 — Today (build development à refaire : expo-haptics, expo-keep-awake, expo-audio)
- [ ] Cocher une série : vibration légère, cercle rempli, compteur X / N, barre de repos en bas.
- [ ] Dernière série d'un exercice : carte verte + vibration « succès ».
- [ ] Barre de repos : −15 s / +15 s / Passer ; rouge et vibration d'alerte sous 10 s ; deux bips + flash vert à 0.
- [ ] Musique en fond : les bips se mêlent sans couper la musique ; mode silencieux iOS : pas de bip.
- [ ] Gainage (chronométré) : tap → chrono d'effort, cercle en attente ; à la fin la série se coche et le repos démarre ; second tap annule.
- [ ] Verrouiller le téléphone pendant un repos, rouvrir après la fin : « terminé » sans son.
- [ ] Tuer l'app pendant un repos, rouvrir avant la fin : le décompte reprend au bon temps.
- [ ] Appui long sur un cercle : saisie poids / reps ; valeurs conservées après fermeture de l'app.
- [ ] Poids de carte −/+ et saisie « 102,5 » ; valeur retrouvée à la séance suivante.
- [ ] Échange vers une alternative : nom + « remplace … », poids propre à la variante ; retour à l'original retrouve son poids.
- [ ] Glisser-déposer : appui long sur le titre d'une carte puis glisser ; le défilement est bloqué pendant le glisser ; ordre conservé.
- [ ] VoiceOver / TalkBack : actions « Monter » / « Descendre » sur une carte.
- [ ] Écran allumé pendant une séance en cours sur l'onglet Today ; se met en veille normalement ailleurs ou si désactivé dans Profil.
- [ ] Terminer : confirmation si séries restantes, récapitulatif (durée, séries, volume), « Rouvrir ».
- [ ] « Dernière fois » affiché à la séance suivante du même exercice.
- [ ] Laisser une séance en cours puis changer de jour (ou avancer l'heure du téléphone après minuit) : bandeau « Séance du … non terminée » avec Reprendre / Terminer.
- [ ] Réinitialiser la séance du jour : séries effacées, poids et ordre conservés.

## M3a — Plan + Éditeur (pas de nouveau build nécessaire)
- [ ] Plan : onglets « Cette semaine » / « Mes programmes », l'indicateur glisse et le contenu coulisse ; aucune animation si « réduire les animations » est activé.
- [ ] Cette semaine : lundi → dimanche, séance du jour badgée, repos atténués ; « Ajouter une séance » ouvre l'éditeur à l'étape 2.
- [ ] Mes programmes : tap = activer (toast), Dupliquer (« (copie) »), Supprimer (confirmation) ; le programme actif supprimé bascule sur un autre.
- [ ] Éditeur plein écran : Annuler (confirmation), Enregistrer depuis chaque étape ; erreurs listées, un tap ramène à l'étape.
- [ ] Étape 2 / étape 4 : glisser-déposer des séances et des exercices (appui long sur le titre) ; actions VoiceOver « Monter / Descendre ».
- [ ] Fenêtre d'exercice : clavier numérique ou texte selon le champ ; la feuille reste utilisable clavier ouvert (champs du bas visibles).
- [ ] Steppers séries (1–20) et repos (pas de 15 s) ; chronométré change le placeholder.
- [ ] Couleur choisie conservée après enregistrement ; type « Repos » met la séance en gris si la couleur était automatique.
- [ ] Tuer l'app en pleine édition puis la rouvrir : bannière « Brouillon en cours », Reprendre retrouve les modifications.
- [ ] Renommer un exercice : son poids mémorisé et « Dernière fois » sont conservés dans Today.

## M3b — Onboarding + Import (build development à refaire : expo-document-picker)
- [ ] Réinstaller l'app (ou effacer ses données) : l'onboarding s'affiche ; FR/EN s'applique immédiatement.
- [ ] « Essayer avec le programme exemple » → Today avec le programme exemple.
- [ ] « Créer mon programme » → éditeur ; Annuler → retour à l'onboarding ; Enregistrer → onglets.
- [ ] « Importer un fichier JSON » → sélecteur iOS (Fichiers, iCloud Drive) / Android (Téléchargements, Drive) ; annuler ne fait rien.
- [ ] Choisir `workout-backup-2026-10-07.json` : aperçu « 2 programmes, 8 séances, 115 séries, 10 poids » + ignorés (8).
- [ ] « Restaurer » → confirmation → thème clair appliqué, Today affiche la séance du jour, « Dernière fois » présent, aucun bandeau « non terminée ».
- [ ] Coller un programme JSON dans la zone de texte → aperçu → importé et activé (Plan → Mes programmes).
- [ ] Plan → Mes programmes → « Importer » ouvre l'écran d'import.
- [ ] Supprimer tous les programmes : Today propose « Créer » et « Importer » (pas d'onboarding).

## M4a — Profil (build development à refaire : expo-sharing)
- [ ] Profil affiche la carte du programme actif (nom, séances / semaine, unité) ; « Gérer mes programmes » ouvre Plan sur « Mes programmes », même après être revenu sur « Cette semaine ».
- [ ] Unité par défaut sur lbs → Plan › « Créer un nouveau programme » : l'éditeur propose lbs.
- [ ] Coach IA : l'interrupteur garde sa position après redémarrage de l'app.
- [ ] « Exporter mes données » → feuille de partage iOS (Fichiers, iCloud Drive, AirDrop) / Android ; fichier `workout-backup-AAAA-MM-JJ.json` ; le rappel passe à « aujourd'hui ».
- [ ] Le fichier exporté se réimporte via Profil › Importer : mêmes programmes, séances et poids.
- [ ] Web : « Exporter mes données » télécharge le fichier.
- [ ] Sans export depuis plus de 14 jours (ou jamais) : rappel en rouille.
- [ ] Minuteur de repos lancé → « Supprimer l'historique » → minuteur arrêté, Today sans séries cochées, programme et poids conservés.
- [ ] « Réinitialiser l'application » → onboarding ; langue et thème conservés.
- [ ] « À propos » affiche la version de `app.json`.

## M4b — Stats (pas de nouveau build : react-native-svg est dans Expo Go)
- [ ] Expo Go (iPhone) : sans séance terminée, Stats affiche « Termine ta première séance pour voir tes stats ».
- [ ] Après restauration de la sauvegarde : dernière séance « BAS DU CORPS », records (Presse à cuisses 110 kg…), calendrier avec les séances visibles.
- [ ] Période « Tout » : la courbe de Tirage vertical montre 3 points, le record (40 kg) en or ; bascule « 1RM estimé ».
- [ ] La période choisie est conservée après redémarrage.
- [ ] Terminer une séance avec une charge plus haute qu'avant → « 1 nouveau record » dans Dernière séance et badge « Nouveau » dans Records.
- [ ] Planning Lun/Mer/Ven : un jour prévu manqué apparaît avec un contour rouille ; aujourd'hui n'est pas compté manqué.
- [ ] Web : la courbe et le calendrier s'affichent, largeur adaptée à la fenêtre.
- [ ] Thème clair : couleurs lisibles (courbe, calendrier, badges).
