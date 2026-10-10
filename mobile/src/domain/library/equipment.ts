// Matériel de la bibliothèque — valeurs sources regroupées
import type { Lang } from '../prefs';

export const EQUIPMENT_KEYS = [
  'bodyweight', 'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'band',
  'weighted', 'ball', 'pullup_bar', 'bench', 'cardio_machine', 'other',
] as const;
export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

const LABELS: Record<EquipmentKey, { fr: string; en: string }> = {
  bodyweight: { fr: 'Poids du corps', en: 'Bodyweight' },
  barbell: { fr: 'Barre', en: 'Barbell' },
  dumbbell: { fr: 'Haltères', en: 'Dumbbells' },
  kettlebell: { fr: 'Kettlebell', en: 'Kettlebell' },
  cable: { fr: 'Poulie', en: 'Cable' },
  machine: { fr: 'Machine', en: 'Machine' },
  band: { fr: 'Élastique', en: 'Band' },
  weighted: { fr: 'Lest / disque', en: 'Weight / plate' },
  ball: { fr: 'Ballon', en: 'Ball' },
  pullup_bar: { fr: 'Barre de traction', en: 'Pull-up bar' },
  bench: { fr: 'Banc', en: 'Bench' },
  cardio_machine: { fr: 'Machine cardio', en: 'Cardio machine' },
  other: { fr: 'Autre', en: 'Other' },
};

export const isEquipmentKey = (v: unknown): v is EquipmentKey => typeof v === 'string' && (EQUIPMENT_KEYS as readonly string[]).includes(v);
export const equipmentLabel = (key: EquipmentKey, lang: Lang): string => LABELS[key][lang];
