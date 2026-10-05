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
