import { fireEvent, screen } from '@testing-library/react-native';
import { AccentPicker } from '@/features/editor/AccentPicker';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ListEditor } from '../ListEditor';
import { NumberStepper } from '../NumberStepper';

describe('NumberStepper', () => {
  it('incrémente par pas et respecte les bornes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<NumberStepper value={90} min={0} max={600} step={15} label="Repos" onChange={onChange} />);
    expect(screen.getByText('90')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Repos' }));
    expect(onChange).toHaveBeenLastCalledWith(105);
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Repos' }));
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it('boutons désactivés aux bornes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<NumberStepper value={1} min={1} max={20} label="Séries" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Séries' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ListEditor', () => {
  it('modifie, ajoute et retire des éléments ; plafond respecté', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <ListEditor items={['Vélo']} onChange={onChange} placeholder="ex" addLabel="Ajouter" maxItems={2} maxLength={200} testID="wu" />,
    );
    await fireEvent.changeText(screen.getByTestId('wu-0'), 'Vélo 5 min');
    expect(onChange).toHaveBeenLastCalledWith(['Vélo 5 min']);
    await fireEvent.press(screen.getByTestId('wu-add'));
    expect(onChange).toHaveBeenLastCalledWith(['Vélo', '']);
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer 1' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('bouton Ajouter absent au plafond', async () => {
    await renderWithProviders(
      <ListEditor items={['a', 'b']} onChange={jest.fn()} placeholder="ex" addLabel="Ajouter" maxItems={2} maxLength={200} testID="wu" />,
    );
    expect(screen.queryByTestId('wu-add')).toBeNull();
  });
});

describe('AccentPicker', () => {
  it('sélectionne une couleur', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<AccentPicker value="gold" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Or' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Bleu' }));
    expect(onChange).toHaveBeenCalledWith('blue');
  });
});
