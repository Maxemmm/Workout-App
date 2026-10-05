/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { createIdGenerator } from '../ids';

const rnd = (n: number) => new Uint8Array(randomBytes(n));
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createIdGenerator (UUID v7)', () => {
  it('produit un UUID v7 valide', () => {
    expect(createIdGenerator(rnd)()).toMatch(UUID_V7);
  });

  it('encode le timestamp en tête (48 bits, big-endian)', () => {
    const ts = 1_790_000_000_123;
    const id = createIdGenerator(rnd, () => ts)();
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ts);
  });

  it('est triable chronologiquement', () => {
    let t = 1_790_000_000_000;
    const gen = createIdGenerator(rnd, () => t);
    const a = gen();
    t += 1;
    const b = gen();
    expect(a < b).toBe(true);
  });

  it('ne modifie pas le tableau fourni par la source aléatoire', () => {
    const fixed = new Uint8Array(16);
    createIdGenerator(() => fixed, () => 1)();
    expect(Array.from(fixed)).toEqual(new Array(16).fill(0));
  });
});
