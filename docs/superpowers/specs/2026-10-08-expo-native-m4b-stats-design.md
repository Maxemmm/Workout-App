# App native Expo — Jalon M4b (Stats) — Addendum de design

> Complète `2026-10-05-expo-native-foundation-design.md` (§4 écran Stats, tests `domain/` stats) et fait suite au M4a. En cas de divergence avec la spec du sous-projet 1, **cet addendum l'emporte pour le M4b**.

## 0. Périmètre

**Objectif :** un écran Stats qui reprend la PWA (série en cours, volume de la semaine, dernière séance, courbe de charge par exercice avec record) et l'enrichit grâce aux poids et reps enregistrés par série.

**Inclus :** résumé (3 cartes) ; section Exercice (sélecteur, courbe Charge max / 1RM estimé, record, meilleure série, 1RM estimé, volume) ; Assiduité (calendrier 12 semaines + taux) ; Records (liste, badge « Nouveau ») ; filtre de période mémorisé.

**Hors M4b :** histogramme mensuel de la PWA (remplacé par le calendrier) ; zoom / défilement des courbes ; export des stats.

**Changement par rapport à la spec du sous-projet 1 :** les graphiques ne passent **pas** par `victory-native` (Skia) mais par des composants SVG maison sur `react-native-svg`. Raison : l'app est testée via **Expo Go (iPhone) et le web**, sans build ; Skia sur le web impose CanvasKit (~3 Mo de wasm + configuration Metro) pour des graphiques simples.

**Architecture retenue :** une seule lecture de l'historique (`statsRepo.readHistory`) ; tous les calculs dans `domain/stats/`, purs et testés ; écran découpé en sections.

**Dépendance :** `react-native-svg` (incluse dans Expo Go, native sur le web). **Aucun nouveau build.**

---

## 1. Règles communes

- **Séances prises en compte :** statut `completed`, non supprimées. Les séances `abandoned` et `in_progress` sont exclues de toutes les stats.
- **Séries prises en compte :** `done = true`, non supprimées.
- **Exercice suivi :** couple `(exerciseId, performedName)`. Une alternative (`performedName` non nul) est un exercice distinct, comme pour les poids mémorisés (M2). Nom affiché : `performedName` s'il existe, sinon le nom de l'exercice dans la définition du programme de la séance (même supprimé), sinon l'`exerciseId`.
- **Volume :** Σ poids × reps sur les séries ayant un poids > 0 **et** des reps > 0. Les séries au poids du corps comptent comme séries, pas dans le volume.
- **Unités :** le poids d'une série est dans l'unité (`meta.units`) du programme de sa séance. Tout est converti dans l'unité du programme actif (défaut `kg` sans programme actif) : 1 lb = 0,45359237 kg. Affichage arrondi : volume à l'unité, charges à 0,5 près (1 décimale max).
- **1RM estimé (Epley) :** `poids × (1 + reps / 30)`, seulement pour 1 ≤ reps ≤ 12 et poids > 0 ; sinon pas de 1RM pour cette série. Pour reps = 1, 1RM = poids.
- **Meilleure série :** la série au plus haut 1RM estimé ; égalité → la plus récente.
- **Jours :** dates locales `AAAA-MM-JJ` (`workouts.date`) ; semaines du lundi au dimanche.
- **Période** (`statsPeriod`) : `4w` = 28 derniers jours, `3m` = 91, `1y` = 365, `all` = sans limite ; aujourd'hui inclus. Défaut `3m`. S'applique aux sections Exercice et Assiduité (taux) ; pas au résumé, au calendrier (toujours 12 semaines) ni aux records.

## 2. Contenu

**Résumé (3 cartes)**
- **Série en cours.** Planning du programme actif non vide : nombre de séances prévues consécutives faites, en remontant depuis la plus récente séance faite un jour prévu ; 0 si un jour prévu entre cette séance et aujourd'hui (exclu) n'a pas de séance faite. Un jour prévu « fait » = au moins une séance terminée ce jour-là. Sans planning (ou sans programme actif) : nombre de jours calendaires consécutifs avec une séance, en partant d'aujourd'hui (ou d'hier si aujourd'hui n'en a pas).
- **Volume de la semaine.** Lundi → aujourd'hui, comparé à la même plage de la semaine précédente (lundi → même jour de la semaine). Écart en % arrondi ; pas d'écart si la semaine précédente vaut 0.
- **Dernière séance.** Date, nom de séance, nombre de séries, durée (`completedAt − startedAt`, en minutes ; masquée si ≤ 0 ou > 6 h), « N nouveaux records » si la séance a établi au moins un record de charge (voir Records).

**Exercice**
- Sélecteur : pastilles défilantes des exercices ayant au moins une série faite dans **tout** l'historique, triés par dernière date d'utilisation (récent d'abord) ; le choix est conservé tant que l'écran est monté (pas persisté). Par défaut : le premier.
- Bascule **Charge max** / **1RM estimé**. Un point par séance dans la période : charge max des séries de cet exercice (ou meilleur 1RM estimé) ; séance sans poids → pas de point.
- Point record (valeur max de la série affichée) en or ; étiquettes : premier point, dernier point, record.
- Sous la courbe : Record de charge (valeur + date, tout l'historique), Meilleure série (« 100 kg × 8 », tout l'historique), 1RM estimé (de la meilleure série), Volume sur la période.
- Exercice sans aucun poids : message « Aucun poids enregistré pour cet exercice » (clé `stats_no_weight` existante) à la place de la courbe et des chiffres de charge.

**Assiduité**
- **Calendrier** : 12 semaines (lundi → dimanche), la dernière contenant aujourd'hui. Case :
  - `done` : au moins une séance terminée ce jour ;
  - `missed` : jour prévu par le planning du programme actif, passé (avant aujourd'hui), sans séance, et **≥ date de création du programme actif** ;
  - `rest` : jour non prévu (ou avant la création du programme) sans séance ;
  - `today` : aujourd'hui sans séance (marqué, ni fait ni manqué) ;
  - `future` : après aujourd'hui.
- **Taux** sur la période : faites / prévues, où « prévues » = jours prévus passés ou aujourd'hui fait, ≥ création du programme actif, dans la période ; « faites » = parmi eux, ceux avec séance. Affiché « 9 / 12 séances prévues (75 %) » ; sans planning : seulement le nombre de séances de la période.

**Records**
- Un record de charge par exercice suivi : charge max (convertie), date de la première séance où elle a été atteinte, meilleur 1RM estimé.
- Une séance « établit un record » pour un exercice si sa charge max dépasse strictement toutes les charges des séances antérieures de cet exercice (la toute première séance d'un exercice n'est **pas** un record).
- Badge « Nouveau » si la date du record est dans les 7 derniers jours (aujourd'hui inclus) et que ce n'est pas la première séance de l'exercice.
- Liste triée par date de record (récent d'abord).

**États vides :** aucune séance terminée → l'écran affiche seulement le titre et « Termine ta première séance pour voir tes stats ».

## 3. Unités de code

| Unité | Rôle |
|---|---|
| `db/repos/statsRepo.ts` | `readHistory(ctx): StatsHistory` — séances terminées non supprimées (date, sessionKey, nom de séance, unité, startedAt, completedAt), leurs séries faites (exerciseId, performedName, poids, reps), noms d'exercices (programmes même supprimés) ; programme actif (planning, unité, `createdAt`) ou `null` |
| `domain/stats/types.ts` | `StatsHistory`, `HistoryWorkout`, `HistorySet`, `ActivePlan` |
| `domain/stats/units.ts` | `toUnit(weight, from, to)` |
| `domain/stats/oneRm.ts` | `estimateOneRm(weight, reps)`, `bestSet(sets)` |
| `domain/stats/period.ts` | `StatsPeriod = '4w' \| '3m' \| '1y' \| 'all'`, `periodStart(period, today)` |
| `domain/stats/summary.ts` | `currentStreak`, `weekVolume`, `lastSession` |
| `domain/stats/exerciseSeries.ts` | `trackedExercises`, `exerciseSeries`, `exerciseStats` |
| `domain/stats/attendance.ts` | `attendanceCalendar`, `attendanceRate` |
| `domain/stats/records.ts` | `personalRecords`, `recordsSetBy(workout)` |
| `db/repos/settingsRepo.ts` | Clé `statsPeriod: StatsPeriod` |
| `features/stats/StatsScreen` | Assemble ; lit l'historique via `useDbQuery` ; période via `Segmented` |
| `features/stats/SummaryCards`, `ExerciseSection`, `AttendanceSection`, `RecordsList` | Sections |
| `features/stats/LineChart` | Courbe SVG (`react-native-svg`) : points, ligne, record en or, 3 étiquettes, largeur via `onLayout` |
| `features/stats/AttendanceCalendar` | Grille de `View` (7 colonnes × 12 lignes) |
| `app/(tabs)/stats.tsx` | Route mince (ErrorBoundary + `StatsScreen`) |

## 4. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Définition de programme illisible (séance d'un programme corrompu) | Séance gardée ; nom de séance = `sessionKey`, unité = unité active, noms d'exercices = ids |
| `statsPeriod` illisible | `3m` |
| Poids négatif ou nul, reps nulles | Ignorés pour charge / 1RM / volume ; la série compte comme série |
| Durée incohérente | Masquée |
| Erreur de rendu | `TabErrorBoundary` existant |

## 5. Tests

- **domain (TDD, cas construits) :** conversion kg ↔ lbs ; 1RM (reps 1, 12, 13 ignoré, poids 0) ; meilleure série et égalité ; période (bornes 4w / 3m / 1y / all) ; série en cours (Lun/Mer/Ven avec une séance manquée → 0 ; consécutive → N ; sans planning → jours calendaires ; aujourd'hui pas encore fait ne casse pas la série) ; volume semaine (bornes lundi, écart %, semaine précédente à 0) ; exclusion des séances abandonnées ; exercices suivis et alternatives distinctes ; points de courbe par séance ; record = première atteinte ; première séance non comptée comme record ; badge « Nouveau » à 7 jours / 8 jours ; calendrier (fait, manqué, repos, avant création du programme, aujourd'hui, futur) ; taux.
- **domain (vraie sauvegarde anonymisée)** : valeurs exactes calculées au moment du plan (nombre d'exercices suivis, record d'un exercice, taux d'assiduité sur `all`).
- **db :** `readHistory` inclut l'historique d'un programme supprimé, exclut les séances non terminées et les séries non faites, relit les noms d'exercices.
- **UI (RNTL) :** écran vide ; écran rempli depuis la fixture (résumé, records) ; changement d'exercice ; bascule Charge / 1RM ; période mémorisée (`statsPeriod`) ; nombre de points de la courbe (`testID` par point).
- **Checklist appareil M4b :** Expo Go (iPhone) et web.
