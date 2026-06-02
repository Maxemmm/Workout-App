# Feature : Dashboard de progression

## Vue d'ensemble

Page secondaire de l'app (onglet « Stats » ou icône graphe dans la nav).
Affiche l'historique de progression sans aucun backend — tout vit dans
`localStorage`. Accessible depuis l'app principale, même esthétique
(noir / doré / rouille).

---

## Données à stocker

À chaque séance terminée (bouton explicite « Terminer la séance »),
logger un objet horodaté dans localStorage :

```js
// Clé : "log:2026-05-31"
{
  date: "2026-05-31",         // YYYY-MM-DD
  session: "full-body",       // clé de session dans program.js
  completed: true,            // false si séance abandonnée
  exercises: [
    { id: "presse-cuisses", weight: 110, sets: 4, reps: 8 },
    { id: "tirage-horizontal", weight: 40, sets: 4, reps: 10 },
    // un objet par exercice réalisé
  ]
}
```

Les clés existantes (`weight:<id>`) restent pour l'affichage dans la
séance du jour. Le log est la source pour le dashboard.

---

## Métriques

| Métrique | Calcul |
|---|---|
| Courbe de progression par exercice | `weight` par `id`, trié par date |
| Record personnel (PR) | `max(weight)` par `id` sur tout l'historique |
| Volume par séance | `Σ (sets × reps × weight)` par jour |
| Courbe de progression globale | volume total ou charge moyenne dans le temps |
| Assiduité | séances `completed: true` vs séances prévues au planning |

---

## Écrans du dashboard

**Vue résumé (page d'accueil du dashboard)**
- Streak actuel (jours consécutifs avec séance complétée)
- Volume cette semaine vs semaine précédente
- Dernière séance + date

**Vue par exercice**
- Sélecteur : liste de tous les exercices déjà loggés
- Courbe charge (kg) au fil des dates
- PR mis en évidence
- Volume par séance sur cet exercice

---

## Contraintes techniques

- Chart.js via CDN (pas de build step, compatible mono-fichier)
- Pas de backend, pas de compte
- Bouton « Exporter mes données » → télécharge un fichier JSON
  (sauvegarde manuelle si changement de téléphone)
- Bouton « Importer » → recharge un JSON exporté précédemment
- Même design system que l'app (palette, typo, cartes)

---

## Déclencheur du log

Bouton explicite **« Terminer la séance »** affiché quand toutes les
séries sont cochées (ou accessible à tout moment). Évite les logs
partiels si l'app est fermée en cours de route.

---

## Quand implémenter

Après l'étape 8 du plan de développement (persistance + saisie de
poids fonctionnels). Le schéma de log s'ajoute sans casser l'existant.