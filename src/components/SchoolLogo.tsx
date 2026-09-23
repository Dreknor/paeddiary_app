import { Image } from 'expo-image';

import { useAuth } from '@/auth/AuthContext';

const fallbackLogo = require('../../assets/icon.png');

/** Logo der verbundenen Schule (aus `/instance`), sonst das mitgelieferte App-Icon. */
export function SchoolLogo({ size = 72 }: { size?: number }) {
  const { server } = useAuth();
  const uri = server?.instance.logo_url;
  return (
    <Image
      source={uri ? { uri } : fallbackLogo}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}
