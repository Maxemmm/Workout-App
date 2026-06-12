#!/usr/bin/env bash
# test-api.sh — Equivalents curl pour tester l'edge function
# Usage : BASE_URL=http://localhost:3000 bash api/test-api.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== CAS VALIDE — 3 jours, salle, intermédiaire ==="
curl -s -X POST "$BASE_URL/api/generate-program" \
  -H "Content-Type: application/json" \
  -d '{"objectif":"Prise de masse","frequence":3,"materiel":["Salle de sport complète"],"niveau":"intermédiaire","antecedents":"Légère douleur épaule droite"}' \
  | jq '{ok: (has("program")), meta: .program.meta.label, sessions: (.program.sessions | keys), schedule: .program.schedule}'

echo ""
echo "=== CAS INVALIDE — objectif manquant ==="
curl -s -X POST "$BASE_URL/api/generate-program" \
  -H "Content-Type: application/json" \
  -d '{"frequence":3,"materiel":["Salle de sport complète"],"niveau":"intermédiaire"}' \
  | jq .

echo ""
echo "=== CAS INVALIDE — frequence=7 ==="
curl -s -X POST "$BASE_URL/api/generate-program" \
  -H "Content-Type: application/json" \
  -d '{"objectif":"Sèche","frequence":7,"materiel":["Salle de sport complète"],"niveau":"avancé"}' \
  | jq .

echo ""
echo "=== CAS INVALIDE — niveau inconnu ==="
curl -s -X POST "$BASE_URL/api/generate-program" \
  -H "Content-Type: application/json" \
  -d '{"objectif":"Recomposition","frequence":4,"materiel":["Machines guidées uniquement"],"niveau":"expert"}' \
  | jq .
