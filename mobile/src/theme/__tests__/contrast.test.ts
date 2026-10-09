// Lisibilité dans les deux thèmes (WCAG : texte ≥ 4,5:1, éléments graphiques ≥ 3:1)
import { contrastRatio, readableOn } from '../resolve';
import { palettes } from '../tokens';

describe.each(['dark', 'light'] as const)('contraste — thème %s', (scheme) => {
  const p = palettes[scheme];

  it('texte des boutons dorés (onGold sur gold) ≥ 4,5', () => {
    expect(contrastRatio(p.onGold, p.gold)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte sur le vert « terminé » (onDone sur greenDone) ≥ 4,5', () => {
    expect(contrastRatio(p.onDone, p.greenDone)).toBeGreaterThanOrEqual(4.5);
  });

  it('courbe et éléments dorés sur les cartes ≥ 3', () => {
    expect(contrastRatio(p.gold, p.bgCard)).toBeGreaterThanOrEqual(3);
  });

  it('numéro d\'une série cochée lisible sur chaque couleur d\'accent', () => {
    for (const fill of [p.goldFill, p.rustFill, p.blueFill, p.textDim]) {
      expect(contrastRatio(readableOn(fill), fill)).toBeGreaterThanOrEqual(4.4);
    }
  });
});
