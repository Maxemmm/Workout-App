import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { BonusBlock } from '../BonusBlock';
import { CardioBlock } from '../CardioBlock';
import { ProgressBar } from '../ProgressBar';
import { RestDayScreen } from '../RestDayScreen';
import { RulesBlock } from '../RulesBlock';
import { TipsList } from '../TipsList';
import { WarmupBlock } from '../WarmupBlock';

describe('blocs Today', () => {
  it('ProgressBar : libellé et compteur', async () => {
    await renderWithProviders(<ProgressBar done={3} total={10} accent="gold" />);
    expect(screen.getByText('SÉRIES FAITES')).toBeTruthy();
    expect(screen.getByText('3 / 10')).toBeTruthy();
  });

  it('échauffement, cardio, bonus', async () => {
    await renderWithProviders(
      <>
        <WarmupBlock items={['Vélo 5 min']} />
        <CardioBlock label="Marche inclinée" detail="15 min" />
        <BonusBlock title={null}><Text>carte</Text></BonusBlock>
      </>,
    );
    expect(screen.getByText('ÉCHAUFFEMENT')).toBeTruthy();
    expect(screen.getByText('· Vélo 5 min')).toBeTruthy();
    expect(screen.getByText('Marche inclinée')).toBeTruthy();
    expect(screen.getByText('BONUS')).toBeTruthy();
    expect(screen.getByText('carte')).toBeTruthy();
  });

  it('règles repliées par défaut', async () => {
    await renderWithProviders(<RulesBlock rules={['Garder 1 à 2 reps en réserve']} />);
    expect(screen.queryByText('· Garder 1 à 2 reps en réserve')).toBeNull();
    await fireEvent.press(screen.getByText('RÈGLES'));
    expect(screen.getByText('· Garder 1 à 2 reps en réserve')).toBeTruthy();
  });

  it('conseils et repos implicite', async () => {
    await renderWithProviders(
      <>
        <TipsList tips={[{ title: 'Cible', body: 'RPE 6-7' }]} accent="blue" />
        <RestDayScreen />
      </>,
    );
    expect(screen.getByText('Cible')).toBeTruthy();
    expect(screen.getByText('RPE 6-7')).toBeTruthy();
    expect(screen.getByTestId('rest-day')).toBeTruthy();
  });
});
