/** Route du sélecteur : une seule réponse, et une sortie sans réponse (geste retour) vaut « Annuler » */
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
let captured: { onPick(item: { id: string; name: string }): void; onFree(): void; onCancel(): void } | null = null;
jest.mock('@/features/library/ExercisePicker', () => ({
  ExercisePicker: (props: NonNullable<typeof captured>) => {
    captured = props;
    return null;
  },
}));

import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import EditorLibraryRoute from '@/app/editor/library';
import { LIBRARY_PICK_INITIAL, useLibraryPickStore } from '@/state/libraryPickStore';

const request = { sessionKey: 's', section: 'main' as const, form: null, exerciseId: null };

describe('route /editor/library', () => {
  beforeEach(() => { jest.clearAllMocks(); captured = null; useLibraryPickStore.setState(LIBRARY_PICK_INITIAL); });

  it('sortie par geste retour (aucune réponse) → « cancel »', async () => {
    useLibraryPickStore.getState().start(request);
    const view = await render(<EditorLibraryRoute />);
    await act(async () => { view.unmount(); });
    expect(useLibraryPickStore.getState().result).toBe('cancel');
  });

  it('réponse donnée puis démontage : la réponse est gardée', async () => {
    useLibraryPickStore.getState().start(request);
    const view = await render(<EditorLibraryRoute />);
    captured?.onFree();
    await act(async () => { view.unmount(); });
    expect(useLibraryPickStore.getState().result).toBeNull();
  });

  it('double appui : un seul retour', async () => {
    useLibraryPickStore.getState().start(request);
    await render(<EditorLibraryRoute />);
    captured?.onPick({ id: 'ds:0001', name: 'A' });
    captured?.onPick({ id: 'ds:0002', name: 'B' });
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(useLibraryPickStore.getState().result).toEqual({ libraryId: 'ds:0001', name: 'A' });
  });
});
