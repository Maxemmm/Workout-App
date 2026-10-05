import { screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { parseOrThrow } from '@/domain/__fixtures__/builders';
import { resolveDay } from '@/domain/schedule';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TodayHeader } from '../TodayHeader';

const program = parseOrThrow(example);

describe('TodayHeader', () => {
  it('affiche la séance planifiée et ses groupes musculaires', async () => {
    await renderWithProviders(<TodayHeader programLabel="PROGRAMME SALLE" dateLabel="LUN, 5 OCT" plan={resolveDay(program, 1)} />);
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('FULL BODY')).toBeTruthy();
    expect(screen.getByText(program.sessions['full-body'].subtitle!)).toBeTruthy();
    expect(screen.getByText('LUN, 5 OCT')).toBeTruthy();
  });

  it('affiche REPOS pour un jour hors planning', async () => {
    await renderWithProviders(<TodayHeader programLabel="X" dateLabel="MAR, 6 OCT" plan={resolveDay(program, 2)} />);
    expect(screen.getByText('REPOS')).toBeTruthy();
  });
});
