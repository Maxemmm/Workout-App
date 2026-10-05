import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { translate, translateList, type StringKey } from '../translate';

describe('dictionnaires', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('ne contiennent plus de HTML', () => {
    const values = [...Object.values(fr), ...Object.values(en)].flat();
    expect(values.filter((v) => /<[a-z/]/i.test(String(v)))).toEqual([]);
  });
});

describe('translate', () => {
  it('traduit selon la langue', () => {
    expect(translate('fr', 'today_sets_done')).toBe('Séries faites');
    expect(translate('fr', 'profile_theme')).toBe('Thème');
    expect(translate('en', 'profile_theme')).toBe('Theme');
  });

  it("substitue %s dans l'ordre", () => {
    expect(translate('fr', 'exo_load_label_fmt', 'kg')).toBe('Poids (kg)');
  });

  it('retourne la clé si elle est inconnue', () => {
    expect(translate('en', 'nope' as StringKey)).toBe('nope');
  });

  it('traduit les listes (jours, mois)', () => {
    expect(translateList('fr', 'days_short')).toHaveLength(7);
    expect(translateList('fr', 'days_short')[1]).toBe('Lun');
    expect(translateList('fr', 'months_short')).toHaveLength(12);
  });
});
