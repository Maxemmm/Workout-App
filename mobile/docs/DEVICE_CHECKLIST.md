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
