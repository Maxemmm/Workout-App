/** Fin d'import : la modale se ferme puis l'onglet visé s'affiche (pas de second jeu d'onglets empilé) */
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismiss: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canDismiss: jest.fn(() => true) },
}));
let captured: { onDone(kind: 'program' | 'backup'): void; onCancel(): void } | null = null;
jest.mock('@/features/import/ImportScreen', () => ({
  ImportScreen: (props: { onDone(kind: 'program' | 'backup'): void; onCancel(): void }) => {
    captured = props;
    return null;
  },
}));

import { render } from '@testing-library/react-native';
import { router } from 'expo-router';
import ImportRoute from '@/app/import';

describe('route import', () => {
  beforeEach(() => { jest.clearAllMocks(); captured = null; });

  it('programme importé : fermer la modale puis aller sur Plan', async () => {
    await render(<ImportRoute />);
    captured?.onDone('program');
    expect(router.dismiss).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/plan');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sauvegarde restaurée : fermer la modale puis aller sur Today', async () => {
    await render(<ImportRoute />);
    captured?.onDone('backup');
    expect(router.dismiss).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/today');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
