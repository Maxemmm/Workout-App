// Thème de navigation : le fond visible pendant les transitions et le glissement retour
// doit être celui de l'app (jamais le blanc / gris par défaut de React Navigation)
import { navigationTheme } from '../navigationTheme';
import { palettes } from '../tokens';

describe.each(['dark', 'light'] as const)('navigationTheme — %s', (scheme) => {
  const p = palettes[scheme];
  const theme = navigationTheme(p, scheme);

  it('fond des conteneurs et des cartes = fond de l\'app', () => {
    expect(theme.colors.background).toBe(p.bg);
    expect(theme.colors.card).toBe(p.bgCard);
  });

  it('textes, bordures et couleur principale du thème', () => {
    expect(theme.dark).toBe(scheme === 'dark');
    expect(theme.colors.text).toBe(p.text);
    expect(theme.colors.border).toBe(p.border);
    expect(theme.colors.primary).toBe(p.gold);
  });

  it('polices de React Navigation conservées (requises par ses composants)', () => {
    expect(theme.fonts.regular).toBeDefined();
  });
});
