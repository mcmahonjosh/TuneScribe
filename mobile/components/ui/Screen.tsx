import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

export default function Screen({
  children,
  scroll = false,
  contentContainerStyle,
  style,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    {
      backgroundColor: theme.background,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    style,
  ];

  if (scroll) {
    return (
      <ScrollView
        style={containerStyle}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[containerStyle, styles.content, contentContainerStyle]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
});
