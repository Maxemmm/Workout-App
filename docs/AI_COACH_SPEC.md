# AI_COACH_SPEC.md — Feature IA Coach & Roadmap produit

> Spec technique et produit pour l'intégration d'un coach IA
> dans la Workout App. S'appuie sur REFONTE_V2.md et CLAUDE.md.
> Objectif : passer d'une app personnelle à un produit déployable
> sur le marché, progressivement, sans dette technique.

---

## 1. Stratégie de déploiement

### Plateforme

**Phase 1 (mois 0-3) : PWA**
Déploiement immédiat via GitHub Pages. Installation iPhone via
Safari → "Ajouter à l'écran d'accueil". Suffisant pour valider
le concept et acquérir les premiers utilisateurs.

**Phase 2 (mois 3-6) : App native (React Native / Expo)**
Migration déclenchée si : traction utilisateurs confirmée ET
demandes répétées d'App Store. L'architecture localStorage → API
se transpose directement. Délai estimé : 2-3 semaines de travail.

**Indicateur de bascule :** 50+ utilisateurs actifs hebdomadaires
OU 10+ demandes explicites d'App Store.

### Stack technique cible

```
Frontend        HTML/CSS/JS vanilla (PWA) → React Native/Expo
Backend         Vercel Edge Functions (Node.js)
IA beta         Google Gemini API — Gemini 2.0 Flash (gratuit)
IA production   API Anthropic (Claude Sonnet) — pay-per-use
BDD (Phase 2)   Supabase (auth + sync multi-device)
Paiements       Stripe (abonnements) — Phase monétisation
```

### Stratégie provider IA

Le backend est une couche d'abstraction : l'app PWA ne sait jamais
quel modèle génère le programme. Changer de provider = modifier
une variable d'environnement dans Vercel, sans toucher au frontend.

```
Phase beta (mois 0-3)     Google Gemini 2.0 Flash
                           Free tier : 1 500 req/jour
                           Carte bancaire : non requise
                           Coût : 0€

Phase lancement (mois 3+) Anthropic Claude Sonnet
                           Pay-per-use : ~0,01€/génération
                           Qualité supérieure pour JSON complexe
                           Couvert par abonnements Pro
```

**Fallbacks disponibles si besoin :**
- Groq (Llama 3) : free tier ~14 400 req/jour, latence excellente
- OpenRouter : 1$ crédits offerts, accès multi-modèles
- Mistral : bon niveau sur le français, free tier limité

### Évolution de l'architecture

```
Aujourd'hui          Mois 3               Mois 9
───────────          ──────────           ──────────────────
PWA statique    →    PWA + API       →    App native + BDD
localStorage         localStorage +       Comptes users +
GitHub Pages         Vercel +             sync multi-device +
                     Gemini API (free)    dashboard coaches
                     → Anthropic (si
                       traction confirmée)
```

Chaque étape est **additive**. Rien n'est jeté.

---

## 2. Feature IA Coach

### Principe RGPD

Les données santé ne quittent jamais l'appareil de manière
persistante. Le contexte utilisateur **transite** vers l'API
IA pour la génération, mais **n'est jamais stocké** côté serveur.

```
Ce qui transite (session uniquement, jamais écrit sur disque) :
  objectif, fréquence, matériel, antécédents libres

Ce qui ne quitte JAMAIS le téléphone :
  logs de séances, poids personnels, historique complet
```

Mentions légales requises dans l'app : préciser que les données
saisies pour la génération IA transitent via l'API Google (Gemini)
en phase beta, puis l'API Anthropic en production, et ne sont
pas conservées.
- Politique de rétention Gemini API : 0 jour par défaut
- Politique de rétention Anthropic API : 0 jour par défaut

---

### 2A. Phase beta — Flux avec Gemini API (gratuit)

La génération IA appelle directement Gemini 2.0 Flash via une
Vercel Edge Function. L'utilisateur ne quitte jamais l'app.
Free tier Google : 1 500 requêtes/jour — largement suffisant
pour une beta à 200 utilisateurs.

**Prérequis :**
- Créer un projet sur Google AI Studio (aistudio.google.com)
- Générer une clé API gratuite (sans carte bancaire)
- Ajouter `GEMINI_API_KEY` dans les variables d'environnement Vercel

**Flux utilisateur :**
```
Écran "Créer avec l'IA"
        ↓
Questionnaire in-app (4 étapes, voir §2C)
        ↓
Bouton "GÉNÉRER MON PROGRAMME"
        ↓
Appel → Vercel Edge Function → Gemini 2.0 Flash API
        ↓
Validation du JSON retourné
        ↓
Prévisualisation du programme dans l'app
        ↓
[Modifier] ou [Utiliser ce programme]
→ Stockage localStorage → programme actif
```

**Edge function beta (Gemini) :**
```js
// /api/generate-program (Vercel Edge Function)
export default async function handler(req) {

  const { objectif, frequence, materiel, niveau, antecedents } = req.body;

  const prompt = buildCoachPrompt({ objectif, frequence, materiel,
                                    niveau, antecedents });

  // Appel Gemini 2.0 Flash — gratuit, 1500 req/jour
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      })
    }
  );

  const data = await response.json();
  const raw = data.candidates[0].content.parts[0].text;

  // Validation stricte avant envoi — jamais de JSON invalide stocké
  const program = validateProgramJSON(raw);

  // Rien n'est stocké côté serveur
  return Response.json({ program });
}
```

**Coûts Gemini 2.0 Flash :**
```
Free tier    : 1 500 requêtes/jour — 0€
Pay-as-you-go: ~0,001€/génération (si free tier dépassé)
200 users × 1 génération/mois = 200 req/mois → 0€
```

---

### 2B. Phase production — Migration vers Anthropic

Déclenchée quand le free tier Gemini devient insuffisant OU
quand la qualité de génération doit être améliorée.
Changement : une variable d'environnement dans Vercel.
Le frontend ne change pas.

**Edge function production (Anthropic) :**
```js
// /api/generate-program — même endpoint, provider différent
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic();

export default async function handler(req) {

  const { objectif, frequence, materiel, niveau, antecedents } = req.body;
  const prompt = buildCoachPrompt({ objectif, frequence, materiel,
                                    niveau, antecedents });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }]
  });

  const program = validateProgramJSON(response.content[0].text);
  return Response.json({ program });
}
```

**Coûts Anthropic (Claude Sonnet) :**
```
Par génération : ~2000 tokens input + 1500 output ≈ 0,01€
100 générations/mois  → ~1€
1 000 générations/mois → ~10€
Couvert dès ~3 abonnements Pro actifs (3 × 4,99€ = ~15€/mois)
```

**Prompt système coach (partagé entre les deux providers) :**
```
Tu es un coach sportif expert en musculation et préparation physique.
Génère un programme d'entraînement personnalisé au format JSON strict.

Règles absolues :
- Réponds UNIQUEMENT avec le JSON, sans texte avant ni après
- Respecte exactement le schéma fourni (structure program.example.json)
- Les id d'exercices sont en kebab-case, uniques, stables
- Les restSec sont des entiers (60, 90, 120, 180)
- Les sets sont des entiers entre 1 et 6
- Le schedule utilise les indices Date.getDay() (0=dim … 6=sam)
- Adapte le volume et l'intensité au niveau déclaré
- Prends en compte les antécédents pour exclure les exercices
  contre-indiqués
```

---

### 2C. Questionnaire IA (4 étapes in-app)

Design : même esthétique que l'app (dark, doré, cards).
Barre de progression en haut. Bouton "Retour" toujours présent.
Les réponses sont stockées temporairement en mémoire (jamais
dans localStorage).

**Étape 1 — Objectif principal**
```
Sélection unique, cards visuelles :
  🏋 Gagner en force
  📐 Prise de masse
  🔥 Sèche / définition
  ⚖️  Recomposition corporelle
  💪 Forme générale
```

**Étape 2 — Disponibilités**
```
Combien de jours par semaine ?
  [2]  [3]  [4]  [5]  [6]
Durée moyenne par séance :
  [30 min]  [45 min]  [1h]  [1h30+]
```

**Étape 3 — Matériel disponible**
```
Sélection multiple :
  🏠 Haltères à la maison
  🏋 Salle de sport complète
  📦 Machines guidées uniquement
  🪢 Élastiques / poids de corps
  🚲 Cardio machines (vélo, tapis)
```

**Étape 4 — Contexte libre**
```
Niveau :
  [Débutant]  [Intermédiaire]  [Avancé]

Antécédents importants (blessures, contre-indications…)
┌─────────────────────────────────────┐
│ Texte libre — 300 caractères max    │
│                                     │
└─────────────────────────────────────┘
(optionnel — ces informations transitent
 vers l'IA et ne sont pas conservées)
```

**Étape 5 — Génération**
```
Récapitulatif des choix
[GÉNÉRER MON PROGRAMME]  ← CTA gold, pleine largeur

Animation de génération :
  Spinner + messages rotatifs :
  "Analyse de ton profil..."
  "Construction du programme..."
  "Optimisation des exercices..."
  "Finalisation..."
```

**Post-génération — prévisualisation**
```
Programme généré :
  Nom auto-généré (modifiable)
  Nb de jours · Nb d'exercices

  Aperçu des séances (accordéon)
  ┌─ Lundi — Full Body ─────────────┐
  │  6 exercices · 4×8              │
  └─────────────────────────────────┘

  [✏️ Modifier dans l'éditeur]
  [✅ UTILISER CE PROGRAMME]
```

---

### 2D. Modification IA d'un programme existant

Point d'entrée : bouton "✨ Suggérer des modifications"
dans l'éditeur de programme (Plan → Modifier).

```
Contexte libre :
┌─────────────────────────────────────┐
│ Ex: "J'ai une douleur au genou,     │
│ adapte les exercices jambes"        │
└─────────────────────────────────────┘

[ANALYSER ET SUGGÉRER]
        ↓
Diff visuel :
  Exercices supprimés  (fond rouge atténué, barré)
  Exercices ajoutés    (fond vert atténué, + )
  Exercices modifiés   (fond gold atténué, ✏️)

  [Accepter tout]  [Refuser tout]
  ou case par case pour chaque modification
```

---

## 3. Monétisation

### Modèle : Freemium → Abonnement Pro

**Beta (mois 0-3) : 100% gratuit**
Objectif : 200+ utilisateurs actifs, feedback produit,
validation de la feature IA.
Pas de carte bleue, pas de paywall.

**Post-beta : Freemium**

```
GRATUIT
├── Création de programme manuelle illimitée
├── Suivi de séances illimité
├── Historique 30 jours
├── 1 génération IA / mois
└── 1 programme actif

PRO — 4,99€/mois · 39,99€/an (→ -33%)
├── Générations IA illimitées
├── Modification IA de programmes existants
├── Historique illimité
├── Courbes de progression avancées
├── Programmes multiples illimités
└── Export de données

COACH — 24,99€/mois  [Phase 2 — mois 6+]
├── Tout Pro
├── Gestion jusqu'à 20 clients
├── Dashboard de suivi clients
├── Partage / assignation de programmes
└── Rapports de progression exportables
```

**Implémentation paiements :**
Stripe Checkout + Stripe Customer Portal.
Côté app : vérification du statut abonnement via un token
JWT signé par le backend (Vercel).
Côté serveur : aucune donnée d'entraînement stockée —
uniquement { userId, plan, expiresAt }.

---

## 4. Roadmap produit

### Mois 1-2 : Lancement PWA
- [ ] Finaliser REFONTE_V2 (moteur + éditeur + stats)
- [ ] Créer compte Google AI Studio + clé API Gemini (gratuit)
- [ ] Déployer Vercel Edge Function + intégration Gemini
- [ ] Intégrer flux IA complet dans l'app (questionnaire → génération)
- [ ] Landing page simple (GitHub Pages, même repo /landing)
- [ ] Beta fermée : 20-50 testeurs recrutés manuellement

### Mois 3-4 : Validation & itération
- [ ] Analyser usage beta (feature IA utilisée ? taux de conversion ?)
- [ ] Migrer vers Anthropic API si qualité insuffisante ou traction forte
- [ ] Implémenter Stripe si utilisateurs prêts à payer
- [ ] Décision PWA → natif selon indicateurs (voir §1)

### Mois 5-6 : Croissance
- [ ] App Store / Play Store (React Native / Expo)
- [ ] Landing page marketing séparée
- [ ] Programme de referral (inviter un ami)

### Mois 7-12 : B2B Coaches
- [ ] Comptes coaches (Supabase auth)
- [ ] Dashboard multi-clients
- [ ] Partage de programmes
- [ ] Facturation B2B (Stripe)

---

## 5. Landing page

Une page statique dans le même repo (/landing ou domaine séparé).
Objectif : convertir les visiteurs en installateurs PWA.

Structure minimale :
```
Hero    : Tagline + CTA "Installer l'app" (lien PWA)
Démo    : GIF ou vidéo courte du flux IA coach
Features: 3 points clés (IA, suivi, progression)
Pricing : Gratuit pendant la beta
Footer  : Mentions légales, politique de confidentialité
```

La politique de confidentialité est obligatoire dès que
l'app appelle une API externe. Template RGPD à inclure.

---

## 6. Ce qui ne change pas dans l'architecture existante

- Design system REFONTE_V2 : inchangé
- Moteur de séance (Today) : inchangé
- Éditeur de programme : on ajoute un point d'entrée IA,
  le reste est intact
- localStorage : on ajoute { userId, plan } quand
  l'authentification arrive, le reste est inchangé
- Pas de breaking change entre les phases

---

## 7. Prochaine étape pour Claude Code

Une fois REFONTE_V2 terminée et stable :

```
Lis AI_COACH_SPEC.md en entier.
Implémente la feature IA Coach (§2A — Phase beta Gemini) :

1. Créer /api/generate-program en Vercel Edge Function
   - Provider : Google Gemini 2.0 Flash
   - Variable d'environnement : GEMINI_API_KEY
   - Validation stricte de la requête entrante
   - Validation du JSON retourné avant envoi (validateProgramJSON)
   - Aucun log, aucun stockage côté serveur

2. Écran "Créer avec l'IA" dans le flux onboarding
   (alternative à "Créer moi-même")

3. Questionnaire 4 étapes (§2C) avec le design système existant
   - Les réponses vivent en mémoire uniquement (jamais localStorage)
   - Barre de progression en haut
   - Bouton Retour toujours présent

4. Appel à l'edge function depuis l'app
   - Animation de génération (spinner + messages rotatifs)
   - Gestion des erreurs (timeout, JSON invalide, quota dépassé)

5. Prévisualisation du programme généré
   - Aperçu des séances en accordéon
   - [Modifier dans l'éditeur] / [Utiliser ce programme]

Montre-moi d'abord l'edge function Gemini et la fonction
validateProgramJSON avant de construire les écrans.
Je veux valider la couche API avant l'UI.
```
