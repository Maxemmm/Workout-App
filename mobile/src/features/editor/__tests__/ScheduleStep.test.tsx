import { act, fireEvent, screen } from '@testing-library/react-native';
import { getActiveProgram } from '@/db/repos/programsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, newDraft, setMeta, updateSession } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ScheduleStep } from '../ScheduleStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });

describe('ScheduleStep', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('7 jours lundi → dimanche ; choisir une séance puis repos ; enregistrer', async () => {
    const ctx = createTestCtx();
    const { draft, key } = addSession(setMeta(newDraft(), { label: 'P' }), 'lift', () => 'aaaa');
    await act(async () => { useDraftStore.getState().start(ctx, updateSession(draft, key, { name: 'FULL' })); });
    const n = nav();
    await renderWithProviders(<ScheduleStep nav={n} />, { ctx });
    expect(screen.getAllByTestId(/^day-row-\d$/).map((r) => r.props.testID)).toEqual(
      ['day-row-1', 'day-row-2', 'day-row-3', 'day-row-4', 'day-row-5', 'day-row-6', 'day-row-0'],
    );
    await fireEvent.press(screen.getByTestId('day-row-1'));
    await fireEvent.press(screen.getByRole('button', { name: 'FULL' }));
    expect(useDraftStore.getState().draft!.program.schedule).toEqual({ '1': key });
    await fireEvent.press(screen.getByTestId('day-row-3'));
    await fireEvent.press(screen.getByRole('button', { name: 'FULL' }));
    await fireEvent.press(screen.getByTestId('day-row-3'));
    await fireEvent.press(screen.getByRole('button', { name: 'Repos' }));
    expect(useDraftStore.getState().draft!.program.schedule).toEqual({ '1': key });

    await fireEvent.press(screen.getByRole('button', { name: 'ENREGISTRER LE PROGRAMME' }));
    expect(getActiveProgram(ctx)?.definition.meta.label).toBe('P');
    expect(useDraftStore.getState().draft).toBeNull();
    expect(n.finish).toHaveBeenCalled();
  });
});
