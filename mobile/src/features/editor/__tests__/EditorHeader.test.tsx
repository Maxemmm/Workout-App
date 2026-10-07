import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { EditorHeader } from '../EditorHeader';
import { SaveErrorsSheet } from '../SaveErrorsSheet';

describe('EditorHeader', () => {
  it('étape, annuler, enregistrer', async () => {
    const onCancel = jest.fn();
    const onSave = jest.fn();
    await renderWithProviders(<EditorHeader step={2} onCancel={onCancel} onSave={onSave} />);
    expect(screen.getByText('Étape 2 / 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });
});

describe('SaveErrorsSheet', () => {
  it("liste les erreurs traduites ; un tap ouvre l'étape concernée", async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <SaveErrorsSheet
        errors={[{ step: 1, code: 'name_required' }, { step: 4, code: 'session_name_required', sessionKey: 's1' }]}
        sessionName={() => 'Sans nom'}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("Impossible d'enregistrer")).toBeTruthy();
    expect(screen.getByText('Le nom du programme est requis.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Chaque séance doit avoir un nom.'));
    expect(onSelect).toHaveBeenCalledWith({ step: 4, code: 'session_name_required', sessionKey: 's1' });
  });
});
