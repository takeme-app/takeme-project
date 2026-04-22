import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

type BottomSheetDragOptions = {
  /**
   * Deve bater com o `useNativeDriver` do `slideAnim` quando usar `Animated.add(slideAnim, dragY)`.
   * `false` evita incompatibilidade nativa/JS e travamentos em Modal (ex.: RouteScheduleScreen).
   */
  useNativeDriver?: boolean;
};

/**
 * Returns panHandlers + dragY to enable drag-to-dismiss on bottom sheets.
 * Attach panHandlers to the handle bar and apply dragY to the sheet's translateY.
 * The sheet's total translateY should be: Animated.add(slideAnim, dragY) — or just dragY if no slide.
 */
export function useBottomSheetDrag(onClose: () => void, options?: BottomSheetDragOptions) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const useNativeDriver = options?.useNativeDriver !== false;

  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.8) {
          dragY.setValue(0);
          onCloseRef.current();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver, bounciness: 0 }).start();
      },
    })
  ).current;

  const resetDrag = () => dragY.setValue(0);

  return { dragY, panHandlers: panResponder.panHandlers, resetDrag };
}
