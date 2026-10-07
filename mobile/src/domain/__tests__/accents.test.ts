import { ACCENT_KEYS, defaultAccent } from '../accents';

describe('defaultAccent', () => {
  it('cycle or → rouille → bleu sur les séances non-repos', () => {
    expect(defaultAccent('lift', [])).toBe('gold');
    expect(defaultAccent('lift', [{ type: 'lift' }])).toBe('rust');
    expect(defaultAccent('cardio', [{ type: 'lift' }, { type: 'rest' }, { type: 'mixed' }])).toBe('blue');
    expect(defaultAccent('lift', [{ type: 'lift' }, { type: 'lift' }, { type: 'lift' }])).toBe('gold');
  });
  it('gris pour une séance de repos', () => {
    expect(defaultAccent('rest', [{ type: 'lift' }])).toBe('gray');
  });
  it('liste des couleurs', () => {
    expect(ACCENT_KEYS).toEqual(['gold', 'rust', 'blue', 'gray']);
  });
});
