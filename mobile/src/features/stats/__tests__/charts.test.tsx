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

describe('graphiques — thème clair', () => {
  it('trait de la courbe et cases « repos » visibles sur le fond clair', async () => {
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    const { palettes } = require('@/theme/tokens') as typeof import('@/theme/tokens');
    const { contrastRatio } = require('@/theme/resolve') as typeof import('@/theme/resolve');
    const light = palettes.light;
    await renderWithProviders(<LineChart points={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} recordIndex={1} />, { theme: 'light' });
    // react-native-svg transmet la couleur traitée ({ payload: 0xAARRGGBB }) au composant natif
    const toHex = (fill: unknown) => (typeof fill === 'string' ? fill : `#${((fill as { payload: number }).payload & 0xffffff).toString(16).padStart(6, '0')}`);
    const point = screen.getAllByTestId('chart-point')[0];
    expect(contrastRatio(toHex(point.props.fill), light.bgCard)).toBeGreaterThanOrEqual(3);

    await renderWithProviders(<AttendanceCalendar weeks={[[
      { date: '2026-10-05', state: 'rest' as const }, { date: '2026-10-06', state: 'rest' as const },
      { date: '2026-10-07', state: 'rest' as const }, { date: '2026-10-08', state: 'rest' as const },
      { date: '2026-10-09', state: 'rest' as const }, { date: '2026-10-10', state: 'rest' as const },
      { date: '2026-10-11', state: 'rest' as const },
    ]]} />, { theme: 'light' });
    const rest = StyleSheet.flatten(screen.getByTestId('cal-2026-10-05').props.style).backgroundColor as string;
    expect(contrastRatio(rest, light.bg)).toBeGreaterThanOrEqual(1.8);
  });
});
