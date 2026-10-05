import { fireEvent, screen } from '@testing-library/react-native';
import example from '@/data/program.example.json';
import { parseOrThrow } from '@/domain/__fixtures__/builders';
import { weekStrip } from '@/domain/schedule';
import { renderWithProviders } from '@/test/renderWithProviders';
import { WeekStrip } from '../WeekStrip';

const days = weekStrip(parseOrThrow(example), new Date(2026, 9, 5)); // lundi
const labels = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

describe('WeekStrip', () => {
  it('affiche les 7 jours et un seul point « aujourd’hui »', async () => {
    await renderWithProviders(<WeekStrip days={days} selected={1} dayLabels={labels} onSelect={() => {}} />);
    for (let d = 0; d < 7; d++) expect(screen.getByTestId(`day-${d}`)).toBeTruthy();
    expect(screen.getAllByTestId('today-dot')).toHaveLength(1);
  });

  it('marque le jour sélectionné et notifie la sélection, y compris un jour de repos', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(<WeekStrip days={days} selected={1} dayLabels={labels} onSelect={onSelect} />);
    expect(screen.getByTestId('day-1').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId('day-2'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
