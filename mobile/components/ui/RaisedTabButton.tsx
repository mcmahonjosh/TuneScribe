import { type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

export default function RaisedTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const { theme } = useTheme();
  const focused = !!accessibilityState?.selected;

  return (
    <Pressable
      onPress={onPress}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Record"
      accessibilityState={{ selected: focused }}
    >
      <View
        style={[
          styles.circle,
          {
            backgroundColor: theme.primary,
            boxShadow: `0 4px 10px ${theme.primary}59`,
          },
        ]}
      >
        <SymbolView name={'mic.fill' as 'mic.fill'} tintColor={theme.primaryText} size={26} />
      </View>
      <Text
        style={[
          styles.label,
          { color: focused ? theme.tabIconSelected : theme.tabIconDefault },
        ]}
      >
        Record
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    top: -18,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  label: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
});
