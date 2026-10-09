# App native Expo — Jalon M6 (Notification de fin de repos) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (§5.2 `RestNotifier`, §5.3 Notifications) et fait suite au M4b et à la passe UI. En cas de divergence avec la spec du sous-projet 1, **cet addendum l'emporte pour le M6**.

## 0. Périmètre

**Objectif :** être prévenu à la fin d'un repos (ou d'une série chronométrée) quand l'app est en arrière-plan ou le téléphone verrouillé, avec la série à faire et des actions directes.

**Inclus :** notification locale planifiée à la fin du minuteur ; texte « série suivante » ; notification de fin de série chronométrée ; actions « +15 s » (fin de repos) et « Valider la série » (fin de série chronométrée) ; feuille d'autorisation à la première série cochée ; réglage Profil « Alertes de fin de repos ».

**Hors M6 :** Live Activity (M7) ; notifications push / serveur ; web (inerte).

**Architecture retenue (approche A) :** la notification est planifiée **dès le démarrage** du minuteur (heure de fin connue) et remplacée / annulée à chaque changement. Elle part même si iOS a terminé l'app.

**Dépendance :** `expo-notifications` (notifications locales, incluses dans Expo Go). **Aucun nouveau build.**

---

## 1. Comportement

**Planification**
- Une seule notification planifiée à la fois, identifiant fixe `rest-end` (une nouvelle remplace l'ancienne).
- Minuteur démarré (repos ou série chronométrée) → planifiée à `endAt`. Ajusté (±15 s) → replanifiée. Arrêté (Passer, terminé, séance réinitialisée, historique supprimé, réinitialisation, restauration) → annulée.
- Réglage désactivé ou autorisation non accordée → aucune planification (et toute notification en attente est annulée).
- App au premier plan à l'échéance : **pas de bannière ni de son système** (le son et l'haptique de l'app suffisent, comme aujourd'hui).

**Texte** (langue de l'app au moment de la planification)
- Fin de repos (`kind: 'rest'`), titre « Repos terminé » :
  - séries restantes sur l'exercice du minuteur → « {exercice} · série {n}/{total} » + « · {poids} {unité} » si un poids est connu pour cet exercice ;
  - sinon premier exercice suivant (ordre affiché, bonus exclu) non complet → « Suivant : {exercice} · série {n}/{total} » (+ poids) ;
  - sinon → « Toutes les séries sont faites, termine ta séance ».
- Fin de série chronométrée (`kind: 'work'`), titre « Série terminée » → « {exercice} · série {n}/{total} ».
- Nom affiché : variante choisie (alternative) si elle existe, sinon nom du programme.
- « n » = index de la prochaine série non cochée de l'exercice (1-based) ; « total » = nombre de séries.

**Actions**
- Notification `rest` : bouton « +15 s » → nouveau repos de 15 s sur le même exercice / même série (et nouvelle notification).
- Notification `work` : bouton « Valider la série » → équivalent de « Passer » dans la barre (`completeWorkTimer` : série enregistrée, repos suivant démarré).
- Une action est appliquée seulement si le minuteur (ou la séance) correspond encore à celui de la notification (`workoutId`, `exerciseId`, `setIndex`) ; sinon ignorée.
- App terminée : l'action est récupérée au lancement (dernière réponse de notification) et appliquée avec la même règle. Toucher la notification (sans bouton) ouvre l'app.

**Autorisation**
- Première série cochée (premier démarrage de minuteur) et réglage `restAlerts` absent et autorisation jamais demandée → feuille « Être prévenu à la fin du repos » (texte : « même téléphone verrouillé ») avec « Activer » et « Plus tard ».
  - « Activer » → demande système ; `restAlerts = true` (même si l'utilisateur refuse ensuite au niveau iOS : l'état réel est lu à chaque planification).
  - « Plus tard » → `restAlerts = false` ; la feuille ne réapparaît plus.
- Profil › section « Minuteur » › « Alertes de fin de repos » (interrupteur) :
  - activé + autorisation accordée → « Son, vibration et notifications » ;
  - activé + autorisation refusée → « Refusées — autoriser dans Réglages » + bouton « Ouvrir les Réglages » ;
  - activer alors que l'autorisation n'a jamais été demandée → demande système.
- Sans autorisation, le minuteur fonctionne comme avant (premier plan).

**Web :** adaptateur inerte (`permission()` → `'unavailable'`) ; ni feuille ni section Profil.

## 2. Unités

| Unité | Rôle |
|---|---|
| `platform/restNotifier.ts` / `.web.ts` | `permission(): Promise<'granted' \| 'denied' \| 'undetermined' \| 'unavailable'>`, `requestPermission(): Promise<boolean>`, `schedule(n: { endAt: number; title: string; body: string; kind: 'rest' \| 'work'; data: NoticeTarget }): Promise<void>`, `cancel(): Promise<void>`, `onAction(cb: (a: NoticeAction) => void): () => void`, `lastAction(): Promise<NoticeAction \| null>`, `openSettings(): Promise<void>`. À l'import natif : gestionnaire « pas de bannière au premier plan », catégories `rest` (+15 s) et `work` (Valider la série). Simulé globalement dans `jestSetup.js` |
| `platform/types.ts` | `NoticeTarget = { workoutId: string; exerciseId: string; setIndex: number }` ; `NoticeAction = { action: 'plus15' \| 'validate'; kind: 'rest' \| 'work'; target: NoticeTarget }` |
| `domain/restNotice.ts` | `restNotice(input): { titleKey; bodyKey; args }` — pur ; entrée : exercices affichés (`EffectiveExercise[]`), séries cochées par exercice, poids par exercice, unité, minuteur (`mode`, `exerciseId`) |
| `db/repos/settingsRepo.ts` | Clé `restAlerts: boolean` |
| `features/notifications/RestNotificationDriver.tsx` | Sans affichage, monté dans la racine : suit `useTimerStore` (planifie / annule), compose le texte via `loadTodayView` + `restNotice` + i18n, applique les actions (temps réel et au lancement) |
| `features/notifications/AlertsPermissionSheet.tsx` | Feuille d'autorisation (via `BottomSheet`) |
| `features/notifications/permissionFlow.ts` | `shouldAskForAlerts(ctx, permission)` ; `answerAlerts(ctx, accept)` |
| `features/profile/TimerSection.tsx` | Section « Minuteur » de Profil |

Déclenchement de la feuille : Today, à la première série cochée qui démarre un minuteur, si `shouldAskForAlerts`.

## 3. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Planification / annulation en erreur | Ignorée silencieusement (le minuteur au premier plan fonctionne) |
| Séance ou programme introuvable au moment de composer le texte | Texte minimal « Repos terminé » / « Série terminée » sans détail |
| Action reçue pour un minuteur qui ne correspond plus | Ignorée |
| Autorisation retirée dans iOS après coup | Lue à chaque planification : rien n'est planifié ; Profil affiche « Refusées » |

## 4. Tests

- **domain :** `restNotice` — série suivante (même exercice), exercice suivant (ordre affiché, bonus exclu), tout fait, poids présent / absent, alternative, fin de série chronométrée.
- **driver (adaptateur simulé) :** planifie au démarrage (heure de fin, texte, catégorie) ; replanifie à l'ajustement ; annule à l'arrêt ; rien si réglage désactivé ou autorisation refusée ; action « +15 s » → repos de 15 s ; « Valider la série » → série enregistrée + repos ; action périmée ignorée ; action au lancement appliquée.
- **UI :** feuille à la première série seulement ; « Plus tard » ne redemande pas ; « Activer » demande l'autorisation ; Profil : trois états (accordée, refusée + bouton Réglages, désactivé).
- **Checklist appareil M6 (Expo Go) :** notification téléphone verrouillé, app en arrière-plan, app fermée ; pas de bannière app ouverte ; boutons +15 s / Valider la série ; refus puis réactivation dans Réglages.
