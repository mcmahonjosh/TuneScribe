import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import 'react-native-reanimated';

import { ProcessingModeProvider } from '@/context/ProcessingModeContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { lockAppToPortrait } from '@/utils/sheetOrientation';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    void lockAppToPortrait();
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0e14' }}>
        <ActivityIndicator size="large" color="#8b7cf6" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <ProcessingModeProvider>
        <RootLayoutNav />
      </ProcessingModeProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { theme } = useTheme();

  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
        notification: theme.primary,
      },
    }),
    [theme]
  );

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
