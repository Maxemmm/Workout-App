import { act, fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { getSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { parseProgram } from '@/domain/program';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ActiveProgramCard } from '../ActiveProgramCard';
import { SettingsSection } from '../SettingsSection';

const program = (() => {
  const r = parseProgram(example);
  if (!r.ok) throw new Error('exemple invalide');
  return r.program;
})();

describe('ActiveProgramCard', () => {
  it('avec programme : nom, séances par semaine, unité, Gérer', async () => {
    const onManage = jest.fn();
    await renderWithProviders(<ActiveProgramCard program={program} onManage={onManage} onCreate={jest.fn()} onImport={jest.fn()} />);
    expect(screen.getByText(program.meta.label)).toBeTruthy();
    expect(screen.getByText(`3 séances / semaine · ${program.meta.units}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gérer mes programmes' }));
    expect(onManage).toHaveBeenCalled();
  });

  it('sans programme : Créer et Importer', async () => {
    const onCreate = jest.fn();
    const onImport = jest.fn();
    await renderWithProviders(<ActiveProgramCard program={null} onManage={jest.fn()} onCreate={onCreate} onImport={onImport} />);
    expect(screen.getByText('Aucun programme actif')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Importer un fichier JSON' }));
    expect(onCreate).toHaveBeenCalled();
    expect(onImport).toHaveBeenCalled();
  });
});

describe('SettingsSection', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });

  it('unité par défaut : kg sélectionné, lbs enregistré', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<SettingsSection />, { ctx });
    expect(screen.getByRole('button', { name: 'kg' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('button', { name: 'lbs' }));
    expect(getSetting(ctx, 'defaultUnits')).toBe('lbs');
    expect(screen.getByRole('button', { name: 'lbs' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('Coach IA : désactivé par défaut, interrupteur enregistré', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<SettingsSection />, { ctx });
    const sw = screen.getByTestId('ai-switch');
    expect(sw.props.value).toBe(false);
    await fireEvent(sw, 'valueChange', true);
    expect(getSetting(ctx, 'aiEnabled')).toBe(true);
  });

  it('langue et thème toujours présents', async () => {
    await renderWithProviders(<SettingsSection />, { ctx: createTestCtx() });
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clair' })).toBeTruthy();
  });
});
