/** @jest-environment node */
import { parseLegacyBackup } from '@/domain/legacyImport';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { parseNativeBackup, toNativeBackup } from '@/domain/nativeBackup';
import { makeExercise, makeProgramInput, makeSession } from '@/domain/__fixtures__/builders';
import { parseProgram } from '@/domain/program';
import { createCustomExercise, deleteCustomExercise, getCustomExercise, listCustomExercises, updateCustomExercise } from '../repos/customExercisesRepo';
import { readBundle } from '../repos/exportRepo';
import { replaceAll } from '../repos/importRepo';
import { getSetting, setSetting } from '../repos/settingsRepo';
import { createTestCtx } from '../testing/createTestCtx';

const input = { name: 'Presse à cuisses 45°', primary: 'quads' as const, secondary: ['glutes' as const], equipment: 'machine' as const, steps: ['Pousser'] };

describe('exercices personnalisés', () => {
  it('créer, lister, modifier, supprimer (logiquement)', () => {
    const ctx = createTestCtx();
    const c = createCustomExercise(ctx, input);
    expect(listCustomExercises(ctx)).toEqual([c]);
    updateCustomExercise(ctx, c.id, { ...input, name: 'Presse 45°', steps: null });
    expect(getCustomExercise(ctx, c.id)).toMatchObject({ name: 'Presse 45°', steps: null });
    deleteCustomExercise(ctx, c.id);
    expect(listCustomExercises(ctx)).toEqual([]);
    expect(getCustomExercise(ctx, c.id)).toBeNull();
  });

  it('nom vide ou muscle / matériel inconnu → erreur', () => {
    const ctx = createTestCtx();
    expect(() => createCustomExercise(ctx, { ...input, name: '  ' })).toThrow();
    expect(() => createCustomExercise(ctx, { ...input, primary: 'pecs' as never })).toThrow();
    expect(() => createCustomExercise(ctx, { ...input, equipment: 'rocks' as never })).toThrow();
  });
});

describe('programme : libraryId', () => {
  it('conservé par le schéma ; facultatif', () => {
    const r = parseProgram(makeProgramInput({ 1: 's' }, { s: makeSession('S', [makeExercise('dc', 3, { libraryId: 'ds:0025' }), makeExercise('libre')]) }));
    expect(r.ok && r.program.sessions.s.exercises[0].libraryId).toBe('ds:0025');
    expect(r.ok && r.program.sessions.s.exercises[1].libraryId).toBeUndefined();
  });
});

describe('sauvegarde : exercices personnalisés, favoris, mon matériel', () => {
  it('Review Focus 1 : export → restauration dans la même base → mêmes ids, aucun conflit', () => {
    const ctx = createTestCtx();
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture');
    replaceAll(ctx, r.bundle);
    const c = createCustomExercise(ctx, input);
    setSetting(ctx, 'favoriteExercises', ['ds:0001', `custom:${c.id}`]);
    setSetting(ctx, 'myEquipment', ['dumbbell', 'bodyweight']);
    const json = JSON.parse(JSON.stringify(toNativeBackup(readBundle(ctx), 'x')));
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('export illisible');
    replaceAll(ctx, back.bundle); // même base : les ids existent déjà (supprimés logiquement)
    expect(listCustomExercises(ctx)).toEqual([{ ...c }]);
    expect(getSetting(ctx, 'favoriteExercises')).toEqual(['ds:0001', `custom:${c.id}`]);
    expect(getSetting(ctx, 'myEquipment')).toEqual(['dumbbell', 'bodyweight']);

    const fresh = createTestCtx();
    replaceAll(fresh, back.bundle);
    expect(listCustomExercises(fresh).map((x) => x.id)).toEqual([c.id]);
  });

  it('exercice personnalisé invalide dans la sauvegarde : ignoré et signalé', () => {
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture');
    const json = JSON.parse(JSON.stringify(toNativeBackup(r.bundle, 'x')));
    json.customExercises = [
      { id: 'a', name: 'Valide', primary: 'quads', secondary: ['quads', 'glutes', 'pecs'], equipment: 'machine', steps: [] },
      { id: 'b', name: 'Sans muscle', primary: 'pecs', secondary: [], equipment: 'machine', steps: null },
    ];
    const back = parseNativeBackup(json);
    if (!back.ok) throw new Error('export illisible');
    expect(back.bundle.customExercises).toEqual([{ id: 'a', name: 'Valide', primary: 'quads', secondary: ['glutes'], equipment: 'machine', steps: null }]);
    expect(back.bundle.report.ignored).toContainEqual({ key: 'customExercises[1]', reason: 'invalid_value' });
  });

  it('ancienne sauvegarde sans customExercises : valide, liste vide', () => {
    const r = parseLegacyBackup(backup as Record<string, unknown>, '2026-10-07');
    if (!r.ok) throw new Error('fixture');
    const json = JSON.parse(JSON.stringify(toNativeBackup(r.bundle, 'x')));
    delete json.customExercises;
    const back = parseNativeBackup(json);
    expect(back.ok && back.bundle.customExercises).toEqual([]);
  });
});
