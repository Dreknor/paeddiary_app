import { Stack } from 'expo-router';

import { AppLock } from '@/auth/AppLock';
import { colors, font } from '@/theme';

export default function AppLayout() {
  return (
    <AppLock>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: font.weight.semibold, color: colors.text },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Meine Klassen' }} />
        <Stack.Screen name="klasse/[id]" options={{ title: 'Klasse' }} />
        <Stack.Screen name="lerngruppe/[id]" options={{ title: 'Lerngruppe' }} />
        <Stack.Screen name="kalender" options={{ title: 'Woche' }} />
        <Stack.Screen name="schueler/[id]" options={{ title: '' }} />
        <Stack.Screen name="eintrag/neu" options={{ title: 'Neuer Eintrag', presentation: 'modal' }} />
        <Stack.Screen name="eintrag/[id]" options={{ title: 'Eintrag', presentation: 'modal' }} />
        <Stack.Screen name="graduierung/gruppe" options={{ title: 'Gruppenbewertung' }} />
        <Stack.Screen name="graduierung/[sessionId]/index" options={{ title: 'Graduierung' }} />
        <Stack.Screen
          name="graduierung/[sessionId]/abschluss"
          options={{ title: 'Abschluss', presentation: 'modal' }}
        />
        <Stack.Screen name="graduierung/[sessionId]/codes" options={{ title: 'Schüler-iPads' }} />
        <Stack.Screen
          name="graduierung/[sessionId]/selbst"
          options={{ headerShown: false, gestureEnabled: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen name="diagnose/neu" options={{ title: 'Diagnose' }} />
        <Stack.Screen name="dossier/[studentId]" options={{ title: 'Dossier' }} />
        <Stack.Screen name="einstellungen" options={{ title: 'Einstellungen' }} />
        <Stack.Screen name="startseite" options={{ title: 'Startseite', presentation: 'modal' }} />
        <Stack.Screen name="planung/aufgabe" options={{ title: 'Aufgabe', presentation: 'modal' }} />
        <Stack.Screen name="planung/termin" options={{ title: 'Termin', presentation: 'modal' }} />
        <Stack.Screen name="planung/feed" options={{ title: 'Feed' }} />
        <Stack.Screen name="planung/stufen" options={{ title: 'Stufen' }} />
        <Stack.Screen name="planung/diagnose" options={{ title: 'Förderbedarf' }} />
      </Stack>
    </AppLock>
  );
}
