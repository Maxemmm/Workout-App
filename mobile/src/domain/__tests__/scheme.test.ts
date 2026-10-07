import {
  formatScheme, formatWeight, isTimed, parseTimedSeconds, parseWeightInput,
  repsPart, schemeReps, suggestedWeight, weightStep, workSeconds,
} from '../scheme';

const ex = (scheme: string, sets = 3, timed?: boolean) => ({ scheme, sets, timed });

describe('repsPart', () => {
  it('prend la partie après « × » ou tout le schéma', () => {
    expect(repsPart('4×8')).toBe('8');
    expect(repsPart(' 3 × 45 sec ')).toBe('45 sec');
    expect(repsPart('8-12')).toBe('8-12');
    expect(repsPart('')).toBe('');
  });
});

describe('chronométré (règle PWA)', () => {
  it('parseTimedSeconds lit le dernier « N sec »', () => {
    expect(parseTimedSeconds('3×45 sec')).toBe(45);
    expect(parseTimedSeconds('30 sec puis 45 sec')).toBe(45);
    expect(parseTimedSeconds('4×8')).toBe(0);
  });

  it('isTimed : timed explicite prioritaire, sinon « N sec »', () => {
    expect(isTimed(ex('45', 3, true))).toBe(true);
    expect(isTimed(ex('3×45 sec', 3, false))).toBe(false);
    expect(isTimed(ex('3×45 sec'))).toBe(true);
    expect(isTimed(ex('4×8'))).toBe(false);
  });

  it('workSeconds : secondes du schéma, ou nombre nu si timed', () => {
    expect(workSeconds(ex('3×45 sec'))).toBe(45);
    expect(workSeconds(ex('60', 3, true))).toBe(60);
    expect(workSeconds(ex('3×40', 3, true))).toBe(40);
    expect(workSeconds(ex('4×8'))).toBe(0);
    expect(workSeconds(ex('999', 3, true))).toBe(0);
  });
});

describe('schemeReps', () => {
  it("nombre de reps, borne basse d'une fourchette, null sinon", () => {
    expect(schemeReps(ex('4×8'))).toBe(8);
    expect(schemeReps(ex('8-12'))).toBe(8);
    expect(schemeReps(ex('MAX'))).toBeNull();
    expect(schemeReps(ex('3×45 sec'))).toBeNull();
  });
});

describe('formatScheme', () => {
  it('« séries × reps », suffixe sec pour un chronométré', () => {
    expect(formatScheme(ex('4×8', 4))).toBe('4 × 8');
    expect(formatScheme(ex('45', 3, true))).toBe('3 × 45 sec');
    expect(formatScheme(ex('3×45 sec'))).toBe('3 × 45 sec');
    expect(formatScheme(ex('', 2))).toBe('2 × ?');
  });
});

describe('poids', () => {
  it('suggestedWeight prend le premier nombre de load', () => {
    expect(suggestedWeight('100 à 120 kg')).toBe(100);
    expect(suggestedWeight('6,5 kg')).toBe(6.5);
    expect(suggestedWeight('poids du corps')).toBeNull();
    expect(suggestedWeight(null)).toBeNull();
    expect(suggestedWeight('0 kg')).toBeNull();
  });

  it('parseWeightInput accepte la virgule et rejette vide / zéro / négatif / illisible', () => {
    expect(parseWeightInput('102,5')).toBe(102.5);
    expect(parseWeightInput(' 80 ')).toBe(80);
    expect(parseWeightInput('')).toBeNull();
    expect(parseWeightInput('0')).toBeNull();
    expect(parseWeightInput('-5')).toBeNull();
    expect(parseWeightInput('abc')).toBeNull();
  });

  it("weightStep selon l'unité", () => {
    expect(weightStep('kg')).toBe(2.5);
    expect(weightStep('lbs')).toBe(5);
  });

  it('formatWeight sans décimales inutiles', () => {
    expect(formatWeight(100)).toBe('100');
    expect(formatWeight(102.5)).toBe('102.5');
    expect(formatWeight(0.1 + 0.2)).toBe('0.3');
  });
});
