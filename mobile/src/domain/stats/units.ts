// Conversion des charges entre kg et lbs, arrondi d'affichage
import type { Units } from '../program';

const KG_PER_LB = 0.45359237;

export function toUnit(weight: number, from: Units, to: Units): number {
  if (from === to) return weight;
  return from === 'lbs' ? weight * KG_PER_LB : weight / KG_PER_LB;
}

/** Charge affichée : arrondie au 0,5 */
export function roundLoad(weight: number): number {
  return Math.round(weight * 2) / 2;
}
