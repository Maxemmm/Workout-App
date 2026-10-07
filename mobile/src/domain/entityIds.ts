// ============================================================
// Identifiants d'exercices et de séances — lisibles et stables.
// Créés une seule fois ; jamais modifiés (clé des poids et de l'historique).
// ============================================================
export type RandomSuffix = () => string;

const MAX_SLUG = 30;
const ATTEMPTS = 50;

const defaultSuffix: RandomSuffix = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug || 'item';
}

export function makeEntityId(name: string, existing: Iterable<string>, suffix: RandomSuffix = defaultSuffix): string {
  const taken = new Set(existing);
  const base = slugify(name);
  for (let i = 0; i < ATTEMPTS; i++) {
    const id = `${base}-${suffix()}`;
    if (!taken.has(id)) return id;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
