import { act, fireEvent, screen } from '@testing-library/react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { addSession, newDraft } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SessionStep } from '../SessionStep';

const nav = () => ({ goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() });

async function setup() {
  const ctx = createTestCtx();
  const { draft, key } = addSession(newDraft(), 'lift', () => 'aaaa');
  await act(async () => { useDraftStore.getState().start(ctx, draft); });
  const n = nav();
  await renderWithProviders(<SessionStep nav={n} sessionKey={key} />, { ctx });
  const session = () => useDraftStore.getState().draft!.program.sessions[key];
  return { n, key, session };
}

describe('SessionStep', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('nom, couleur, échauffement, exercices (ajout, édition, duplication, suppression), bonus', async () => {
    const { n, session } = await setup();
    await fireEvent.changeText(screen.getByTestId('sess-name'), 'FULL BODY');
    await fireEvent.press(screen.getByRole('radio', { name: 'Bleu' }));
    await fireEvent.press(screen.getByTestId('warmup-add'));
    await fireEvent.changeText(screen.getByTestId('warmup-0'), 'Vélo 5 min');

    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN EXERCICE' }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Squat');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(session()).toMatchObject({ name: 'FULL BODY', accent: 'blue', warmup: ['Vélo 5 min'] });
    expect(session().exercises.map((e) => e.name)).toEqual(['Squat']);
    const squatId = session().exercises[0].id;

    await fireEvent.press(screen.getByRole('button', { name: "Modifier l'exercice Squat" }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Squat barre');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(session().exercises[0]).toMatchObject({ id: squatId, name: 'Squat barre' });

    await fireEvent.press(screen.getByRole('button', { name: 'Dupliquer Squat barre' }));
    expect(session().exercises).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Supprimer Squat barre' })[1]);
    expect(session().exercises.map((e) => e.id)).toEqual([squatId]);

    await fireEvent.press(screen.getByRole('button', { name: 'AJOUTER UN BONUS' }));
    await fireEvent.changeText(screen.getByTestId('exo-name'), 'Abdos');
    await fireEvent.press(screen.getByRole('button', { name: "ENREGISTRER L'EXERCICE" }));
    expect(session().bonus?.exercises.map((e) => e.name)).toEqual(['Abdos']);

    await fireEvent.press(screen.getByRole('button', { name: 'TERMINER LA SÉANCE' }));
    expect(n.closeSession).toHaveBeenCalled();
  });

  it('type cardio : conseils à la place des exercices', async () => {
    const { session } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Cardio' }));
    expect(screen.queryByRole('button', { name: 'AJOUTER UN EXERCICE' })).toBeNull();
    await fireEvent.press(screen.getByTestId('tips-add'));
    await fireEvent.changeText(screen.getByTestId('tip-title-0'), 'Cible');
    await fireEvent.changeText(screen.getByTestId('tip-body-0'), 'RPE 6-7');
    expect(session()).toMatchObject({ type: 'cardio', tips: [{ title: 'Cible', body: 'RPE 6-7' }] });
  });

  it("en-tête : « Séances » revient à la liste sans abandonner le programme", async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    let key = '';
    await act(async () => { useDraftStore.getState().apply(ctx, (d) => { const r = addSession(d); key = r.key; return r.draft; }); });
    const n = nav();
    await renderWithProviders(<SessionStep nav={n} sessionKey={key} />, { ctx });
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Séances' }));
    expect(n.closeSession).toHaveBeenCalled();
    expect(useDraftStore.getState().draft).not.toBeNull();
  });

  it('séance introuvable : retour à la liste', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    const n = nav();
    await renderWithProviders(<SessionStep nav={n} sessionKey="nope" />, { ctx });
    expect(n.closeSession).toHaveBeenCalled();
  });
});
