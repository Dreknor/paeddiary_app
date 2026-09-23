import { Redirect } from 'expo-router';

/**
 * Ziel des SSO-Rücksprungs `paeddiary://auth?code=…`. Den Code wertet `openAuthSessionAsync`
 * in `src/auth/sso.ts` aus; öffnet Android den Link zusätzlich als Route, leiten wir nur weiter.
 */
export default function AuthRedirect() {
  return <Redirect href="/" />;
}
