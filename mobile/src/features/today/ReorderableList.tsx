// ============================================================
// Liste réordonnable — appui long sur la poignée puis glisser.
// Hauteurs mesurées par onLayout ; décalage des voisins animé.
// Repli accessible : actions « Monter » / « Descendre ».
// ============================================================
import type { ReactElement } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

const LONG_PRESS_MS = 300;
const GAP = 12;

export interface ReorderableListProps<T> {
  items: T[];
  keyOf(item: T): string;
  onMove(from: number, to: number): void;
  onDragStateChange?(dragging: boolean): void;
  onItemLayout?(key: string, y: number): void;
  moveUpLabel: string;
  moveDownLabel: string;
  renderItem(item: T, index: number, handle: (title: ReactElement) => ReactElement): ReactElement;
}

/** Index cible : position du centre de l'élément glissé parmi les hauteurs cumulées */
function targetIndex(heights: number[], from: number, dy: number): number {
  'worklet';
  let top = 0;
  for (let i = 0; i < from; i++) top += heights[i] + GAP;
  const center = top + dy + heights[from] / 2;
  let acc = 0;
  for (let i = 0; i < heights.length; i++) {
    const mid = acc + heights[i] / 2;
    if (center < mid) return i <= from ? i : i - 1;
    acc += heights[i] + GAP;
  }
  return heights.length - 1;
}

interface ItemProps {
  index: number;
  count: number;
  itemKey: string;
  heights: SharedValue<number[]>;
  dragIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  props: ReorderableListProps<unknown>;
  item: unknown;
}

function Item({ index, count, itemKey, heights, dragIndex, hoverIndex, dragY, props, item }: ItemProps) {
  const style = useAnimatedStyle(() => {
    const from = dragIndex.value;
    if (from === index) return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10 };
    if (from < 0) return { transform: [{ translateY: withTiming(0, { duration: 150 }) }], zIndex: 0 };
    const h = (heights.value[from] ?? 0) + GAP;
    const to = hoverIndex.value;
    let shift = 0;
    if (from < index && index <= to) shift = -h;
    else if (to <= index && index < from) shift = h;
    return { transform: [{ translateY: withTiming(shift, { duration: 150 }) }], zIndex: 0 };
  });

  const finish = (from: number, to: number) => {
    props.onDragStateChange?.(false);
    if (from !== to) props.onMove(from, to);
  };
  const begin = () => props.onDragStateChange?.(true);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      hoverIndex.value = targetIndex(heights.value, index, e.translationY);
    })
    .onEnd(() => {
      const to = hoverIndex.value;
      dragIndex.value = -1;
      dragY.value = 0;
      runOnJS(finish)(index, to);
    })
    .onFinalize(() => {
      if (dragIndex.value === index) {
        dragIndex.value = -1;
        dragY.value = 0;
        runOnJS(finish)(index, index);
      }
    });

  const onAction = (e: AccessibilityActionEvent) => {
    const to = e.nativeEvent.actionName === 'moveUp' ? index - 1 : index + 1;
    if (to >= 0 && to < count) props.onMove(index, to);
  };

  const handle = (title: ReactElement) => (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{title}</View>
    </GestureDetector>
  );

  return (
    <Animated.View
      testID={`reorder-${itemKey}`}
      style={style}
      accessible={false}
      accessibilityActions={[{ name: 'moveUp', label: props.moveUpLabel }, { name: 'moveDown', label: props.moveDownLabel }]}
      onAccessibilityAction={onAction}
      onLayout={(e) => {
        const next = [...heights.value];
        next[index] = e.nativeEvent.layout.height;
        heights.value = next;
        props.onItemLayout?.(itemKey, e.nativeEvent.layout.y);
      }}
    >
      {props.renderItem(item, index, handle)}
    </Animated.View>
  );
}

export function ReorderableList<T>(props: ReorderableListProps<T>) {
  const heights = useSharedValue<number[]>([]);
  const dragIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  return (
    <View style={styles.list}>
      {props.items.map((item, index) => (
        <Item
          key={props.keyOf(item)}
          index={index}
          count={props.items.length}
          itemKey={props.keyOf(item)}
          heights={heights}
          dragIndex={dragIndex}
          hoverIndex={hoverIndex}
          dragY={dragY}
          props={props as ReorderableListProps<unknown>}
          item={item}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: GAP } });
