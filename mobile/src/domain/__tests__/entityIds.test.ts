import { makeEntityId, slugify } from '../entityIds';

const seq = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('slugify', () => {
  it('minuscules ASCII, accents retirés, séparateurs normalisés', () => {
    expect(slugify('Développé machine')).toBe('developpe-machine');
    expect(slugify('  Tirage — horizontal !! ')).toBe('tirage-horizontal');
  });
  it('Review Focus 4 : vide, emoji, très long', () => {
    expect(slugify('')).toBe('item');
    expect(slugify('💪🔥')).toBe('item');
    const long = slugify('a'.repeat(80));
    expect(long.length).toBeLessThanOrEqual(30);
    expect(slugify(`${'b'.repeat(29)} c`)).not.toMatch(/-$/);
  });
});

describe('makeEntityId', () => {
  it('slug + suffixe', () => {
    expect(makeEntityId('Presse à cuisses', [], seq('k3f9'))).toBe('presse-a-cuisses-k3f9');
  });
  it('évite les collisions avec les ids existants', () => {
    expect(makeEntityId('X', ['x-aaaa'], seq('aaaa', 'aaaa', 'bbbb'))).toBe('x-bbbb');
  });
  it('repli numérique si le suffixe est toujours pris', () => {
    expect(makeEntityId('X', ['x-aaaa', 'x-2'], seq('aaaa'))).toBe('x-3');
  });
  it('suffixe par défaut : 4 caractères base 36', () => {
    expect(makeEntityId('Gainage', [])).toMatch(/^gainage-[a-z0-9]{4}$/);
  });
});
