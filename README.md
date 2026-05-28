# Workout App

Carnet d'entraînement personnel. Application web mono-page, installable sur
iPhone (PWA), qui charge automatiquement la séance du jour, suit les séries
cochées, gère le minuteur de repos et mémorise les poids par exercice.

Usage personnel — un seul utilisateur, pas de compte, pas de serveur.

## Lancer en local

**Option 1 — VS Code Live Server** (recommandé) : installer l'extension Live Server, clic droit sur `index.html` → *Open with Live Server*.

**Option 2 — ligne de commande** :
```bash
npx serve .          # Node.js
python3 -m http.server  # Python
```
Puis ouvrir `http://localhost:8000` (ou le port affiché).

> Ne pas ouvrir `index.html` directement avec `file://` : le navigateur bloque le chargement de `program.js` dans certaines configurations.

## Générer les icônes PNG

Ouvrir `generate-icons.html` dans un navigateur → télécharger les 3 fichiers PNG → les placer à la racine du projet :
```
icon-180.png   ← requis pour l'install iOS (apple-touch-icon)
icon-192.png   ← manifest Android / Chrome
icon-512.png   ← splash screen PWA
```

## Modifier le programme

Toute la routine vit dans **`program.js`** — c'est le seul fichier à éditer.
Modifier les séances et le planning, sauvegarder, commit + push, c'est en ligne.
Ne pas mettre de données d'entraînement dans `index.html`.

Source humaine de référence : `docs/workout.txt`.

## Déploiement (GitHub Pages → iPhone)

1. Push sur la branche `main`.
2. GitHub → Settings → Pages → source : branche `main`, dossier `/ (root)`.
3. Ouvrir l'URL fournie dans Safari sur iPhone.
4. Bouton Partager → « Ajouter à l'écran d'accueil ».

## Structure

- `index.html` — le moteur (UI + logique)
- `program.js` — les données du programme (à éditer)
- `manifest.json`, `icon-180.png` — config PWA
- `docs/` — programme source, exigences, maquettes
- `CLAUDE.md` — contexte projet pour le développement assisté