import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { createProgram, getActiveProgram, listPrograms, setActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import backup from '@/domain/__fixtures__/pwa-backup.json';
import { confirm } from '@/platform/confirm';
import { pickJsonFile } from '@/platform/pickJsonFile';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { TOAST_INITIAL, useToastStore } from '@/state/toastStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ImportScreen } from '../ImportScreen';

async function setup() {
  const ctx = createTestCtx();
  const p = createProgram(ctx, example, 'example');
  setActiveProgram(ctx, p.id);
  const onDone = jest.fn();
  await renderWithProviders(<ImportScreen onDone={onDone} onCancel={jest.fn()} />, { ctx });
  return { ctx, onDone };
}

describe('ImportScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => { usePrefs.setState(PREFS_INITIAL); useToastStore.setState(TOAST_INITIAL); });
  });

  it('coller un programme → aperçu → importer et activer', async () => {
    const { ctx, onDone } = await setup();
    await fireEvent.changeText(screen.getByTestId('import-text'), JSON.stringify({ ...example, meta: { ...example.meta, label: 'NOUVEAU' } }));
    expect(screen.getByText('Programme : NOUVEAU · 3 séances · 3 jours')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'IMPORTER CE PROGRAMME' }));
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('NOUVEAU');
    expect(listPrograms(ctx)).toHaveLength(2);
    expect(useToastStore.getState().message).toBe('Programme importé ✓');
    expect(onDone).toHaveBeenCalledWith('program');
  });

  it('choisir un fichier de sauvegarde → aperçu + ignorés → restauration confirmée, thème appliqué', async () => {
    jest.mocked(pickJsonFile).mockResolvedValueOnce({ kind: 'ok', text: JSON.stringify(backup) });
    const { ctx, onDone } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir un fichier .json' }));
    expect(screen.getByText('Sauvegarde : 2 programmes, 8 séances, 115 séries, 10 poids')).toBeTruthy();
    expect(screen.getByText(/Ignorés \(8\)/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'RESTAURER CETTE SAUVEGARDE' }));
    expect(confirm).toHaveBeenCalled();
    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROGRAMME A', 'PROGRAMME B']);
    expect(usePrefs.getState().theme).toBe('light');
    expect(useToastStore.getState().message).toBe('Sauvegarde restaurée ✓');
    expect(onDone).toHaveBeenCalledWith('backup');
  });

  it('restauration refusée : rien ne change', async () => {
    jest.mocked(confirm).mockResolvedValueOnce(false);
    const { ctx, onDone } = await setup();
    await fireEvent.changeText(screen.getByTestId('import-text'), JSON.stringify(backup));
    await fireEvent.press(screen.getByRole('button', { name: 'RESTAURER CETTE SAUVEGARDE' }));
    expect(listPrograms(ctx).map((p) => p.definition.meta.label)).toEqual(['PROGRAMME SALLE']);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('erreurs : JSON invalide, fichier trop gros ; pas de bouton de confirmation', async () => {
    jest.mocked(pickJsonFile).mockResolvedValueOnce({ kind: 'too_large' });
    await setup();
    await fireEvent.changeText(screen.getByTestId('import-text'), '{oops');
    expect(screen.getByText('JSON invalide — vérifiez la syntaxe.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'IMPORTER CE PROGRAMME' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir un fichier .json' }));
    expect(screen.getByText('Fichier trop volumineux (5 Mo max).')).toBeTruthy();
  });
});

describe('ImportScreen — modale « feuille » iOS', () => {
  it('pas de marge d\'encoche en haut (la feuille commence déjà sous la barre d\'état)', async () => {
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    await renderWithProviders(<ImportScreen onDone={jest.fn()} onCancel={jest.fn()} />, { ctx: createTestCtx(), insets: { top: 59, left: 0, right: 0, bottom: 34 } });
    expect(StyleSheet.flatten(screen.getByTestId('screen-root').props.style).paddingTop).toBe(0);
  });
});
