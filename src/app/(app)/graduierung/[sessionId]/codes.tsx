import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { createJoinCodes, releaseQuestion, revokeJoinCodes } from '@/api/endpoints';
import { queryKeys, useGradingSession } from '@/api/queries';
import type { JoinCode } from '@/api/types';
import { BottomBar } from '@/components/controls';
import { sortedQuestions, studentProgress } from '@/components/grading/session';
import { showToast } from '@/components/Toast';
import { Button, ErrorBox, Loading } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { colors, font, radius, shadow, spacing } from '@/theme';

/** Beitritts-QR-Codes je Schüler für eigene Schüler-iPads, mit Live-Fortschritt. */
export default function JoinCodesScreen() {
  const { sessionId: rawId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(rawId);
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [enlarged, setEnlarged] = useState<JoinCode | null>(null);

  const codes = useQuery({
    queryKey: ['join-codes', sessionId],
    queryFn: () => createJoinCodes(sessionId),
    meta: { persist: false },
    staleTime: Infinity,
  });
  // Fortschritt der Schüler-iPads live verfolgen.
  const { data: session } = useGradingSession(sessionId, 3000);

  const release = useMutation({
    mutationFn: (questionId: number) => releaseQuestion(sessionId, questionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradingSession(sessionId) });
      showToast('Frage freigegeben');
    },
    onError: (e) => Alert.alert('Nicht freigegeben', e.message),
  });

  function revoke() {
    Alert.alert('Codes widerrufen?', 'Alle Schüler-iPads werden von dieser Bewertung getrennt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Widerrufen',
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeJoinCodes(sessionId);
            queryClient.removeQueries({ queryKey: ['join-codes', sessionId] });
            router.back();
          } catch (e) {
            Alert.alert('Fehler', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  if (codes.isLoading) return <Loading />;
  if (codes.error || !codes.data) {
    return (
      <View style={styles.pad}>
        <ErrorBox message={codes.error?.message ?? 'Codes konnten nicht erstellt werden.'} onRetry={codes.refetch} />
      </View>
    );
  }

  const columns = Math.max(2, Math.floor((width - spacing.lg * 2) / 220));
  const byQuestion = session?.data.answer_order_mode === 'by_question';
  const questions = session ? sortedQuestions(session) : [];
  const currentId = session?.meta.current_question_id ?? null;
  const currentIndex = questions.findIndex((q) => q.id === currentId);
  const nextQuestion = questions[currentIndex + 1];

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Schüler-iPads' }} />
      <FlatList
        key={columns}
        data={codes.data}
        numColumns={columns}
        keyExtractor={(c) => String(c.schueler_id)}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.intro}>
              Jedes Kind öffnet auf seinem iPad die App, tippt auf „Ich bin Schüler/in“ und scannt seinen QR-Code (oder
              tippt den Code ein). Tippe auf eine Karte, um den Code groß anzuzeigen.
            </Text>
            {codes.data[0] ? (
              <Text style={styles.muted}>Gültig bis {formatDateTime(codes.data[0].expires_at)}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const p = session ? studentProgress(session, item.schueler_id) : null;
          const done = p && p.total > 0 && p.self >= p.total;
          return (
            <Pressable style={styles.card} onPress={() => setEnlarged(item)} accessibilityRole="button">
              <Text style={styles.name}>{item.firstname}</Text>
              <QRCode value={item.qr_payload} size={120} />
              <Text style={styles.code}>{item.code}</Text>
              {p ? (
                <Text style={[styles.status, done && styles.statusDone]}>
                  {done ? 'fertig ✓' : `${p.self}/${p.total} beantwortet`}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      <BottomBar>
        {byQuestion ? (
          <>
            <Text style={styles.release} numberOfLines={2}>
              {currentIndex >= 0
                ? `Freigegeben: Frage ${currentIndex + 1} von ${questions.length}`
                : 'Noch keine Frage freigegeben'}
            </Text>
            <View style={styles.flex} />
            {nextQuestion ? (
              <Button
                title={currentIndex < 0 ? 'Frage 1 freigeben' : `Frage ${currentIndex + 2} freigeben`}
                onPress={() => release.mutate(nextQuestion.id)}
                loading={release.isPending}
              />
            ) : (
              <Text style={styles.muted}>Alle Fragen freigegeben</Text>
            )}
          </>
        ) : (
          <View style={styles.flex} />
        )}
        <Button title="Codes widerrufen" variant="ghost" onPress={revoke} />
      </BottomBar>

      <Modal visible={!!enlarged} transparent animationType="fade" onRequestClose={() => setEnlarged(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEnlarged(null)}>
          {enlarged ? (
            <View style={styles.enlarged}>
              <Text style={styles.bigName}>{enlarged.firstname}</Text>
              <QRCode value={enlarged.qr_payload} size={Math.min(width - 96, 360)} />
              <Text style={styles.bigCode}>{enlarged.code}</Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
  row: { gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  intro: { fontSize: font.size.sm, color: colors.text },
  muted: { fontSize: font.size.xs, color: colors.textMuted },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow,
  },
  name: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  code: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    letterSpacing: 2,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  status: { fontSize: font.size.xs, color: colors.textMuted },
  statusDone: { color: colors.success, fontWeight: font.weight.semibold },
  release: { fontSize: font.size.sm, color: colors.text, flexShrink: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  enlarged: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  bigName: { fontSize: 32, fontWeight: font.weight.bold, color: colors.text },
  bigCode: { fontSize: 36, fontWeight: font.weight.bold, letterSpacing: 4, color: colors.primary },
});
