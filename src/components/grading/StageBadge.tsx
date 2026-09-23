import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { CurrentStage, GradingStage } from '@/api/types';
import { colors, font } from '@/theme';

type Stage = Pick<NonNullable<CurrentStage>, 'title' | 'symbol' | 'badge_image_url'> | GradingStage | null | undefined;

/** Abzeichen einer Graduierungsstufe: Bild, sonst Symbol, sonst Anfangsbuchstabe. */
export function StageBadge({ stage, size = 40 }: { stage: Stage; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (stage?.badge_image_url) {
    return <Image source={{ uri: stage.badge_image_url }} style={style} contentFit="contain" accessible={false} />;
  }
  return (
    <View style={[styles.fallback, style, !stage && styles.empty]}>
      <Text style={[styles.text, { fontSize: size * 0.45 }]}>
        {stage ? stage.symbol || stage.title.charAt(0) : '–'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  empty: { backgroundColor: colors.divider },
  text: { color: colors.accent, fontWeight: font.weight.bold },
});
