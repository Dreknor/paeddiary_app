import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep Link aus dem Beitritts-QR-Code: `paeddiary://join?server=…&code=…` → Schülermodus. */
export default function JoinLink() {
  const { server, code } = useLocalSearchParams<{ server?: string; code?: string }>();
  return <Redirect href={{ pathname: '/schueler-modus', params: { server: server ?? '', code: code ?? '' } }} />;
}
