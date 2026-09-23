import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { GradingAnswer } from '@/api/types';
import { colors, font, radius, spacing } from '@/theme';

import { RatingScale, SelfRatingBadge } from './scale';

type Props = {
  /** Überschrift der Zeile: Frage (schülerweise) oder Schülername (fragenweise). */
  title: string;
  subtitle?: string;
  answer: GradingAnswer | undefined;
  disabled?: boolean;
  onRate: (value: number | null) => void;
  onComment: (comment: string | null) => void;
};

/** Eine Bewertungszeile: Selbsteinschätzung, Lehrerbewertung 1–5, optional Kommentar. */
export function QuestionRatingRow({ title, subtitle, answer, disabled, onRate, onComment }: Props) {
  const [commentOpen, setCommentOpen] = useState(!!answer?.comment);
  const [comment, setComment] = useState(answer?.comment ?? '');

  function saveComment() {
    const next = comment.trim() || null;
    if (next !== (answer?.comment ?? null)) onComment(next);
  }

  return (
    <View style={[styles.card, disabled && styles.disabled]}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <SelfRatingBadge value={answer?.self_rating} />
      </View>
      <RatingScale value={answer?.rating_value ?? null} onChange={onRate} disabled={disabled} />
      {commentOpen ? (
        <TextInput
          value={comment}
          onChangeText={setComment}
          onBlur={saveComment}
          placeholder="Kommentar (optional)"
          placeholderTextColor={colors.textSubtle}
          multiline
          editable={!disabled}
          style={styles.comment}
          accessibilityLabel="Kommentar"
        />
      ) : !disabled ? (
        <Pressable onPress={() => setCommentOpen(true)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.addComment}>+ Kommentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  disabled: { opacity: 0.6 },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.medium, lineHeight: 22 },
  subtitle: { fontSize: font.size.xs, color: colors.textMuted },
  comment: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: font.size.sm,
    color: colors.text,
    textAlignVertical: 'top',
  },
  addComment: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.weight.medium },
});
