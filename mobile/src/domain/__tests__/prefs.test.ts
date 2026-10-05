import { isLang, isThemePref } from '../prefs';

describe('prefs', () => {
  it('isLang', () => {
    expect(isLang('fr')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(isLang(42)).toBe(false);
  });

  it('isThemePref', () => {
    expect(isThemePref('system')).toBe(true);
    expect(isThemePref('dark')).toBe(true);
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('blue')).toBe(false);
    expect(isThemePref(null)).toBe(false);
  });
});
