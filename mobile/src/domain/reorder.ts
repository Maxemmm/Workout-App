// Réordonnancement : déplace l'élément d'index `from` vers `to` (bornés)
export function moveId(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}
