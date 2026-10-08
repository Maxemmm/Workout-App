import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { AttendanceCalendar } from '../AttendanceCalendar';
import { LineChart } from '../LineChart';

describe('LineChart', () => {
  it('un point par valeur, le record distinct, étiquettes premier / dernier / record', async () => {
    const points = [{ value: 100, label: '100' }, { value: 120, label: '120' }, { value: 110, label: '110' }];
    await renderWithProviders(<LineChart points={points} recordIndex={1} />);
    expect(screen.getAllByTestId(/^chart-(point|record)$/)).toHaveLength(3);
    expect(screen.getAllByTestId('chart-record')).toHaveLength(1);
    // Texte SVG (pas un Text RN) : étiquettes repérées par testID
    expect(screen.getAllByTestId('chart-label')).toHaveLength(3);
  });

  it('un seul point (record) : pas de plantage, étiquette unique', async () => {
    await renderWithProviders(<LineChart points={[{ value: 80, label: '80' }]} recordIndex={0} />);
    expect(screen.getAllByTestId('chart-record')).toHaveLength(1);
    expect(screen.getAllByTestId('chart-label')).toHaveLength(1);
  });
});

describe('AttendanceCalendar', () => {
  it('une case par jour, état lisible ; en-tête lundi → dimanche', async () => {
    const weeks = [[
      { date: '2026-10-05', state: 'done' as const }, { date: '2026-10-06', state: 'rest' as const },
      { date: '2026-10-07', state: 'today' as const }, { date: '2026-10-08', state: 'future' as const },
      { date: '2026-10-09', state: 'future' as const }, { date: '2026-10-10', state: 'future' as const },
      { date: '2026-10-11', state: 'future' as const },
    ]];
    await renderWithProviders(<AttendanceCalendar weeks={weeks} />);
    expect(screen.getByTestId('cal-2026-10-05').props.accessibilityLabel).toBe('2026-10-05 done');
    expect(screen.getAllByTestId(/^cal-/)).toHaveLength(7);
    expect(screen.getByText('Lun')).toBeTruthy();
  });
});
