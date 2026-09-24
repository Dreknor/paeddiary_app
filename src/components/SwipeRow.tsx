import { useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { usePanResponder } from '@/lib/usePanResponder';
import { colors, font, radius, spacing } from '@/theme';

/** Ab dieser Strecke löst das Wischen die Aktion aus. */
const THRESHOLD = 80;

type SwipeAction = { label: string; onSwipe: () => void };

type Props = {
  children: ReactNode;
  /** Nach rechts wischen (z. B. abschließen). */
  right?: SwipeAction;
  /** Nach links wischen (z. B. pausieren). */
  left?: SwipeAction;
};

/**
 * Zeile mit Wischaktionen (ohne native Zusatzbibliothek). Die Aktionen sind zusätzlich
 * als Bedienhilfen-Aktionen erreichbar (VoiceOver/TalkBack).
 */
export function SwipeRow({ children, right, left }: Props) {
  const [translateX] = useState(() => new Animated.Value(0));
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const reset = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(() => setDirection(null));

  const responder = usePanResponder({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_e, g) => {
      const allowed = (g.dx > 0 && right) || (g.dx < 0 && left);
      translateX.setValue(allowed ? g.dx : 0);
      setDirection(g.dx > 0 ? 'right' : g.dx < 0 ? 'left' : null);
    },
    onPanResponderRelease: (_e, g) => {
      const action = g.dx > THRESHOLD ? right : g.dx < -THRESHOLD ? left : undefined;
      reset();
      action?.onSwipe();
    },
    onPanResponderTerminate: reset,
  });

  if (!right && !left) return <>{children}</>;

  const a11yActions = [
    ...(right ? [{ name: 'swipeRight', label: right.label }] : []),
    ...(left ? [{ name: 'swipeLeft', label: left.label }] : []),
  ];

  return (
    <View
      style={styles.wrap}
      accessibilityActions={a11yActions}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'swipeRight') right?.onSwipe();
        if (e.nativeEvent.actionName === 'swipeLeft') left?.onSwipe();
      }}
    >
      {direction ? (
        <View
          style={[styles.background, direction === 'right' ? styles.backgroundRight : styles.backgroundLeft]}
          pointerEvents="none"
        >
          <Text style={[styles.label, direction === 'left' && styles.labelLeft]}>
            {direction === 'right' ? `✓ ${right?.label ?? ''}` : `${left?.label ?? ''} ⏸`}
          </Text>
        </View>
      ) : null}
      <Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  backgroundRight: { backgroundColor: colors.success },
  backgroundLeft: { backgroundColor: colors.warning, alignItems: 'flex-end' },
  label: { color: colors.onPrimary, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  labelLeft: { textAlign: 'right' },
});
