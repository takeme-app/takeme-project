import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

/**
 * Returns panHandlers + dragY to enable drag-to-dismiss on bottom sheets.
 * Attach panHandlers to the handle bar and apply dragY to the sheet's translateY.
 * The sheet's total translateY should be: Animated.add(slideAnim, dragY) — or just dragY if no slide.
 */
export function useBottomSheetDrag(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    })
  ).current;

  const resetDrag = () => dragY.setValue(0);

  return { dragY, panHandlers: panResponder.panHandlers, resetDrag };
}
