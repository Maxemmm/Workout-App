import { accentColors, resolveScheme } from '../resolve';
import { palettes } from '../tokens';

describe('resolveScheme', () => {
  it('respecte un choix explicite', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('suit le système en mode system, sombre si le système est inconnu', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', 'unspecified')).toBe('dark');
  });
});

describe('accentColors', () => {
  const p = palettes.dark;

  it('mappe les clés connues', () => {
    expect(accentColors(p, 'rust')).toEqual({ text: p.rust, fill: p.rustFill });
    expect(accentColors(p, 'blue')).toEqual({ text: p.blue, fill: p.blueFill });
    expect(accentColors(p, 'gray')).toEqual({ text: p.textDim, fill: p.textDim });
  });

  it('retombe sur gold pour une clé inconnue ou absente', () => {
    expect(accentColors(p, 'violet')).toEqual({ text: p.gold, fill: p.goldFill });
    expect(accentColors(p, null)).toEqual({ text: p.gold, fill: p.goldFill });
  });

  it('utilise les teintes assombries du thème clair', () => {
    expect(accentColors(palettes.light, 'gold').text).toBe('#9a6b08');
  });
});
