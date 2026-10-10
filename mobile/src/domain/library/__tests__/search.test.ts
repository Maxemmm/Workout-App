import { normalize, searchLibrary } from '../search';
import type { LibraryFilters, LibraryItem } from '../types';

const item = (o: Partial<LibraryItem> & Pick<LibraryItem, 'id' | 'name'>): LibraryItem => ({
  altName: o.name, primary: 'chest', secondary: [], equipment: 'barbell', steps: null, illustration: null, custom: false, ...o,
});
const items: LibraryItem[] = [
  item({ id: 'ds:1', name: 'Développé couché', altName: 'barbell bench press', illustration: null }),
  item({ id: 'ds:2', name: 'Traction pronation', altName: 'pull-up', primary: 'lats', secondary: ['biceps'], equipment: 'pullup_bar', illustration: 'pull-up' }),
  item({ id: 'ds:3', name: "Curl d'haltères", altName: 'dumbbell curl', primary: 'biceps', equipment: 'dumbbell' }),
  item({ id: 'custom:x', name: 'Mon exercice', altName: 'Mon exercice', primary: 'quads', equipment: 'machine', custom: true }),
];
const none: LibraryFilters = { query: '', muscle: null, equipment: null, favoritesOnly: false, myEquipmentOnly: false };
const ctx = { favorites: [] as string[], myEquipment: [] as ('barbell' | 'dumbbell')[] };
const ids = (r: LibraryItem[]) => r.map((i) => i.id);

describe('normalize', () => {
  it('accents, casse, apostrophes, tirets', () => {
    expect(normalize("Développé  D'Haltères")).toBe('developpe d halteres');
    expect(normalize('Pull-Up')).toBe('pull up');
  });
});

describe('searchLibrary', () => {
  it('sans filtre : illustrés d\'abord, puis ordre alphabétique', () => {
    // illustré (ds:2) d'abord, puis alphabétique : « curl d haltères », « developpe couche », « mon exercice »
    expect(ids(searchLibrary(items, none, ctx))).toEqual(['ds:2', 'ds:3', 'ds:1', 'custom:x']);
  });

  it('Review Focus 2 : recherche sans accents, mots dans le désordre, fr ou en', () => {
    expect(ids(searchLibrary(items, { ...none, query: 'couche developpe' }, ctx))).toEqual(['ds:1']);
    expect(ids(searchLibrary(items, { ...none, query: 'DÉVELOPPÉ' }, ctx))).toEqual(['ds:1']);
    expect(ids(searchLibrary(items, { ...none, query: 'pull up' }, ctx))).toEqual(['ds:2']);
    expect(ids(searchLibrary(items, { ...none, query: 'pull-up' }, ctx))).toEqual(['ds:2']);
    expect(ids(searchLibrary(items, { ...none, query: "d'haltères" }, ctx))).toEqual(['ds:3']);
    expect(ids(searchLibrary(items, { ...none, query: 'bench' }, ctx))).toEqual(['ds:1']);
  });

  it('filtre muscle : principal ou secondaire', () => {
    expect(ids(searchLibrary(items, { ...none, muscle: 'biceps' }, ctx)).sort()).toEqual(['ds:2', 'ds:3']);
  });

  it('filtres combinés : matériel + favoris + mon matériel', () => {
    expect(ids(searchLibrary(items, { ...none, equipment: 'dumbbell' }, ctx))).toEqual(['ds:3']);
    expect(ids(searchLibrary(items, { ...none, favoritesOnly: true }, { ...ctx, favorites: ['ds:1', 'custom:x'] }))).toEqual(['ds:1', 'custom:x']);
    expect(ids(searchLibrary(items, { ...none, myEquipmentOnly: true }, { ...ctx, myEquipment: ['barbell', 'dumbbell'] }))).toEqual(['ds:3', 'ds:1']);
  });

  it('mon matériel vide : filtre sans effet', () => {
    expect(searchLibrary(items, { ...none, myEquipmentOnly: true }, ctx)).toHaveLength(4);
  });
});
