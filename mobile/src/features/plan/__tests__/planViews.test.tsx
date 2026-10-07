import { fireEvent, screen } from '@testing-library/react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { makeExercise, makeProgramInput, makeSession, parseOrThrow } from '@/domain/__fixtures__/builders';
import type { Program } from '@/domain/program';
import { renderWithProviders } from '@/test/renderWithProviders';
import { programSummary } from '../planStats';
import { ProgramsView } from '../ProgramsView';
import { WeekView } from '../WeekView';

const program = parseOrThrow(makeProgramInput({ '1': 'a', '3': 'b' }, {
  a: makeSession('FULL BODY', [makeExercise('x', 3), makeExercise('y', 3)]),
  b: makeSession('HAUT', [makeExercise('z', 3)], { accent: 'rust' }),
}));
const stored = (id: string, label: string): StoredProgram =>
  ({ id, definition: { ...program, meta: { ...program.meta, label } }, source: 'manual', createdAt: '', updatedAt: '' });

describe('planStats', () => {
  it("jours planifiés (séances existantes seulement) et nombre d'exercices", () => {
    expect(programSummary(program)).toEqual({ days: 2, exercises: 3 });
    // Un jour pointant vers une séance absente (impossible via ProgramSchema) n'est pas compté
    const withGhost = { ...program, schedule: { ...program.schedule, '5': 'ghost' } } as Program;
    expect(programSummary(withGhost)).toEqual({ days: 2, exercises: 3 });
  });
});

describe('WeekView', () => {
  it('lundi → dimanche, séance du jour badgée, repos atténués', async () => {
    const MONDAY = new Date(2026, 9, 5, 10);
    await renderWithProviders(<WeekView program={program} today={MONDAY} onAddSession={jest.fn()} onCreate={jest.fn()} />);
    const ids = screen.getAllByTestId(/^week-\d$/).map((n) => n.props.testID);
    expect(ids).toEqual(['week-1', 'week-2', 'week-3', 'week-4', 'week-5', 'week-6', 'week-0']);
    expect(screen.getByText('FULL BODY')).toBeTruthy();
    expect(screen.getByText('2 exercices')).toBeTruthy();
    expect(screen.getByTestId('today-badge')).toBeTruthy();
    expect(screen.getAllByText('Repos').length).toBe(5);
  });

  it('sans programme : message + créer', async () => {
    const onCreate = jest.fn();
    await renderWithProviders(<WeekView program={null} today={new Date()} onAddSession={jest.fn()} onCreate={onCreate} />);
    expect(screen.getByText('Aucun programme actif.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER MON PROGRAMME' }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe('ProgramsView', () => {
  it('cartes, badge Actif, actions', async () => {
    const handlers = { onActivate: jest.fn(), onEdit: jest.fn(), onDuplicate: jest.fn(), onDelete: jest.fn(), onCreate: jest.fn(), onImport: jest.fn() };
    await renderWithProviders(<ProgramsView programs={[stored('a', 'PROG A'), stored('b', 'PROG B')]} activeId="a" {...handlers} />);
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getAllByText('2 jours · 3 exercices').length).toBe(2);
    await fireEvent.press(screen.getByTestId('program-b'));
    expect(handlers.onActivate).toHaveBeenCalledWith('b');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Modifier' })[1]);
    expect(handlers.onEdit).toHaveBeenCalledWith('b');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dupliquer' })[0]);
    expect(handlers.onDuplicate).toHaveBeenCalledWith('a');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    expect(handlers.onDelete).toHaveBeenCalledWith('a');
    await fireEvent.press(screen.getByRole('button', { name: 'CRÉER UN NOUVEAU PROGRAMME' }));
    expect(handlers.onCreate).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Importer' }));
    expect(handlers.onImport).toHaveBeenCalled();
  });
});
