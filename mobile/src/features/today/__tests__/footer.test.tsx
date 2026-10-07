import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { CompletedSummary } from '../CompletedSummary';
import { ResumeBanner } from '../ResumeBanner';
import { TodayFooter } from '../TodayFooter';

describe('pied de séance', () => {
  it('Terminer visible dès une série cochée, Réinitialiser si une séance existe', async () => {
    const onFinish = jest.fn();
    const onReset = jest.fn();
    await renderWithProviders(<TodayFooter canFinish showReset onFinish={onFinish} onReset={onReset} />);
    await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Réinitialiser la séance du jour' }));
    expect(onFinish).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
  });

  it('rien quand aucune séance', async () => {
    await renderWithProviders(<TodayFooter canFinish={false} showReset={false} onFinish={jest.fn()} onReset={jest.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('récapitulatif et rouvrir', async () => {
    const onReopen = jest.fn();
    await renderWithProviders(<CompletedSummary summary={{ durationMin: 48, setsDone: 12, volume: 4520 }} units="kg" onReopen={onReopen} />);
    expect(screen.getByText('SÉANCE TERMINÉE')).toBeTruthy();
    expect(screen.getByText('48 min')).toBeTruthy();
    expect(screen.getByText('4520 kg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rouvrir la séance' }));
    expect(onReopen).toHaveBeenCalled();
  });

  it('bandeau : Reprendre seulement si possible', async () => {
    await renderWithProviders(<ResumeBanner dateLabel="DIM, 4 OCT" canResume={false} onResume={jest.fn()} onFinish={jest.fn()} />);
    expect(screen.getByText('Séance du DIM, 4 OCT non terminée')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeTruthy();
  });
});
