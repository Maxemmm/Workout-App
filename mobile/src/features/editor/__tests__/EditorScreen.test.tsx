import { act, fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { createTestCtx } from '@/db/testing/createTestCtx';
import { newDraft } from '@/domain/draft';
import { DRAFT_INITIAL, useDraftStore } from '@/state/draftStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { EditorScreen } from '../EditorScreen';

const nav = { goToStep: jest.fn(), openSession: jest.fn(), closeSession: jest.fn(), finish: jest.fn() };

describe('EditorScreen', () => {
  beforeEach(() => useDraftStore.setState(DRAFT_INITIAL));

  it('glisser-déposer en cours → défilement de l\'écran bloqué (pas de conflit de gestes)', async () => {
    const ctx = createTestCtx();
    await act(async () => { useDraftStore.getState().start(ctx, newDraft()); });
    await renderWithProviders(
      <EditorScreen nav={nav}>
        {({ onDragStateChange }) => (
          <>
            <Pressable accessibilityRole="button" onPress={() => onDragStateChange(true)}><Text>start</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => onDragStateChange(false)}><Text>end</Text></Pressable>
          </>
        )}
      </EditorScreen>,
      { ctx },
    );
    expect(screen.getByTestId('screen-scroll').props.scrollEnabled).toBe(true);
    await fireEvent.press(screen.getByText('start'));
    expect(screen.getByTestId('screen-scroll').props.scrollEnabled).toBe(false);
    await fireEvent.press(screen.getByText('end'));
    expect(screen.getByTestId('screen-scroll').props.scrollEnabled).toBe(true);
  });
});
