# App native Expo — Jalon M4a (Profil) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (§3.7 export, §4 écran Profil) et fait suite au M3b. En cas de divergence avec la spec du sous-projet 1, **cet addendum l'emporte pour le M4a**. Le M4 est découpé : **M4a Profil**, puis **M4b Stats**.

## 0. Périmètre

**Objectif :** un écran Profil complet — réglages, export de toutes les données, accès à l'import, suppression de l'historique, réinitialisation de l'application, version.

**Inclus :** carte « Programme actif » ; réglages (langue, thème, unité par défaut, écran allumé, Coach IA) ; export natif v1 via la feuille de partage (téléchargement sur le web) avec rappel de sauvegarde ; bouton « Importer » (écran du M3b) ; zone de danger (supprimer l'historique, réinitialiser l'application) ; version.

**Hors M4a :** Stats (M4b) ; alertes du minuteur (M6) ; synchro Santé (M8) ; le Coach IA lui-même (M5 — ici seulement le réglage `aiEnabled`).

**Architecture retenue :** un seul écran défilant découpé en sections (approche A, comme la PWA). L'export relit toute la base en `ImportBundle` (inverse de `replaceAll`) puis le sérialise avec `toNativeBackup` du M3b.

**Dépendance :** `expo-sharing`. **Nouveau build EAS requis.**

---

## 1. Unités

| Unité | Rôle |
|---|---|
| `domain/backupAge.ts` | `backupAge(lastExportAt: string \| undefined, today: string)` → `{ kind: 'never' } \| { kind: 'recent'; days: number } \| { kind: 'stale'; days: number }` ; `stale` si `days > 14` ; jours calendaires locaux |
| `domain/draft.ts` | `newDraft(units: Units = 'kg')` : l'unité du nouveau programme vient du réglage `defaultUnits` |
| `domain/importBundle.ts` | `BundleSettings` gagne `defaultUnits?: Units` (lu et écrit par le format natif v1, champ optionnel : rétrocompatible) |
| `db/repos/settingsRepo.ts` | Nouvelles clés : `defaultUnits: Units`, `lastExportAt: string` (ISO) |
| `db/repos/exportRepo.ts` | `readBundle(ctx)` → `ImportBundle` : programmes non supprimés (id natif comme `sourceId`), id du programme actif, séances, séries, poids, organisations, réglages (`lang`, `theme`, `aiEnabled`, `keepAwake`, `defaultUnits`) |
| `db/repos/resetRepo.ts` | `deleteHistory(ctx)` et `resetAll(ctx)` — chacune en **une** transaction (§2) |
| `platform/shareJsonFile` | `shareJsonFile(fileName, text)` → `Promise<'shared' \| 'cancelled'>` (lève en cas d'erreur). Natif : fichier écrit dans le cache (`expo-file-system`) puis `expo-sharing` ; si le partage n'est pas disponible → erreur. Web : Blob + lien de téléchargement → `'shared'`. Simulé globalement dans `jestSetup.js` |
| `platform/appVersion` | `appVersion()` → version lue dans `expo-constants` (`expoConfig.version`), `'?'` à défaut |
| `features/profile/ProfileScreen` | Assemble les sections ; props `onManagePrograms`, `onCreate`, `onImport` |
| `features/profile/ActiveProgramCard` | Nom, nombre de séances planifiées par semaine, unité, bouton « Gérer » ; sans programme : « Créer » et « Importer » |
| `features/profile/SettingsSection` | Langue, thème, unité par défaut, écran allumé, Coach IA |
| `features/profile/DataSection` | Exporter + rappel de sauvegarde, Importer |
| `features/profile/DangerSection` | Supprimer l'historique, Réinitialiser l'application |

La route `(tabs)/profile.tsx` reste mince. Plan accepte le paramètre `?tab=programs` pour s'ouvrir sur « Mes programmes ».

## 2. Comportement

**Carte « Programme actif ».** Nom (`meta.label`), « N séances / semaine » (jours planifiés), unité. « Gérer » → Plan › Mes programmes. Sans programme actif : « Créer » (même parcours que Today : `prepareEditor` avec confirmation si un brouillon existe) et « Importer ».

**Réglages.**
- Langue, thème, écran allumé : inchangés.
- Unité par défaut (kg / lbs, défaut kg) : utilisée par « Créer » (Plan, Today, onboarding, Profil). Les programmes existants gardent leur `meta.units`.
- Coach IA (interrupteur, défaut désactivé) : écrit `aiEnabled` ; aucun effet visible avant le M5.

**Exporter mes données.**
1. `readBundle` → `toNativeBackup(bundle, maintenant)` → JSON indenté (2 espaces).
2. `shareJsonFile('workout-backup-AAAA-MM-JJ.json', texte)` (date locale du jour).
3. `'shared'` → `lastExportAt = maintenant`, toast « Sauvegarde exportée ». `'cancelled'` → rien. Erreur → toast « Export impossible », `lastExportAt` inchangé.

Le rappel sous le bouton : « Jamais sauvegardé » / « Dernière sauvegarde : aujourd'hui » / « Dernière sauvegarde : il y a N jours » (singulier pour 1) ; couleur rouille si `stale` ou `never`.

**Importer.** Ouvre l'écran d'import du M3b (`/import`).

**Supprimer l'historique** (confirmation destructive ; le message suggère d'exporter d'abord) — en une transaction :
- suppression logique de toutes les séances et séries (y compris la séance en cours) ;
- effacement du minuteur (`activeRest`) ;
- conservés : programmes, programme actif, poids mémorisés, organisations, brouillon, réglages, `lastExportAt`.

**Réinitialiser l'application** (confirmation destructive ; même suggestion) — en une transaction :
- suppression logique de tous les programmes, séances, séries, poids et organisations ;
- suppression de tous les réglages **sauf `lang` et `theme`** (donc `onboarded`, `activeProgramId`, `programDraft`, `activeRest`, `defaultUnits`, `aiEnabled`, `keepAwake`, `healthEnabled`, `lastExportAt` retournent à leur défaut).

Après chaque suppression : les stores (préférences, minuteur, brouillon) sont relus depuis la base, puis `bumpData()`. Après « Réinitialiser l'application », le garde du M3b affiche l'onboarding (aucun programme, `onboarded` absent).

**À propos.** « Version X.Y.Z ».

## 3. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Écriture qui échoue (réglage, suppression, réinitialisation) | Transaction annulée, toast « Action non enregistrée » |
| Partage indisponible ou en erreur | Toast « Export impossible », `lastExportAt` inchangé |
| Partage annulé | Aucun message, `lastExportAt` inchangé |
| Confirmation refusée | Aucune écriture |
| `lastExportAt` illisible | Traité comme « Jamais sauvegardé » |

## 4. Tests

- **domain :** `backupAge` (jamais, aujourd'hui, 1 jour, 14 jours → `recent`, 15 jours → `stale`, valeur illisible → `never`) ; `newDraft('lbs')`.
- **db :**
  - aller-retour sur la vraie sauvegarde anonymisée : `parseLegacyBackup` → `replaceAll` → `readBundle` → `toNativeBackup` → JSON → `parseNativeBackup` → `replaceAll` dans une base vide → 2 programmes, 8 séances, 115 séries, 10 poids, même programme actif (même libellé) ;
  - `readBundle` ignore les lignes supprimées ;
  - `deleteHistory` : plus aucune séance ni série, programmes / poids / organisations / brouillon intacts, `activeRest` effacé ;
  - `resetAll` : base vide, `lang` et `theme` conservés, `needsOnboarding` vrai ;
  - échec au milieu (simulé) → données intactes.
- **UI (RNTL) :** carte programme actif (avec / sans programme) ; export → `shareJsonFile` appelé avec le bon nom, `lastExportAt` écrit et rappel mis à jour ; export annulé → rappel inchangé ; confirmation refusée → rien supprimé ; « Réinitialiser » confirmé → données vidées et `needsOnboarding` vrai ; unité par défaut lbs → « Créer » ouvre un brouillon en lbs ; Plan `?tab=programs` ouvre « Mes programmes ».
- **Checklist appareil M4a :** feuille de partage iOS (Fichiers, iCloud Drive) et Android ; fichier exporté réimporté via l'écran d'import ; téléchargement sur le web ; réinitialisation → onboarding.
