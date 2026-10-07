import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ReorderableList } from '../ReorderableList';

async function renderList(onMove = jest.fn()) {
  await renderWithProviders(
    <ReorderableList
      items={['a', 'b', 'c']}
      keyOf={(s) => s}
      onMove={onMove}
      moveUpLabel="Monter"
      moveDownLabel="Descendre"
      renderItem={(s, i, handle) => handle(<Text>{`${i}:${s}`}</Text>)}
    />,
  );
  return onMove;
}

describe('ReorderableList', () => {
  it("rend les éléments dans l'ordre", async () => {
    await renderList();
    expect(screen.getByText('0:a')).toBeTruthy();
    expect(screen.getByText('2:c')).toBeTruthy();
  });

  it("actions d'accessibilité monter / descendre, bornées", async () => {
    const onMove = await renderList();
    await fireEvent(screen.getByTestId('reorder-b'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(onMove).toHaveBeenLastCalledWith(1, 0);
    await fireEvent(screen.getByTestId('reorder-b'), 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    expect(onMove).toHaveBeenLastCalledWith(1, 2);
    onMove.mockClear();
    await fireEvent(screen.getByTestId('reorder-a'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(onMove).not.toHaveBeenCalled();
  });
});
