import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function NotFoundScreen() {
  const styles = useThemedStyles((t) => ({
    container: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 12 },
    title: { fontSize: 20, fontWeight: '700' as const, color: t.text },
    link: { marginTop: 8, color: t.primary, fontSize: 15, fontWeight: '600' as const },
  }));

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Screen style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          Go to home screen
        </Link>
      </Screen>
    </>
  );
}
