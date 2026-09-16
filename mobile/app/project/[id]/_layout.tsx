import { HeaderBackButton } from '@react-navigation/elements';
import { Stack, useRouter } from 'expo-router';

import { useTheme } from '@/context/ThemeContext';

export default function ProjectIdLayout() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Project',
          headerLeft: () => (
            <HeaderBackButton
              tintColor={theme.text}
              displayMode="minimal"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              accessibilityLabel="Back"
            />
          ),
        }}
      />
      <Stack.Screen name="sheet" options={{ title: 'Sheet music' }} />
    </Stack>
  );
}
