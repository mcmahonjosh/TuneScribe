import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

type TabIconName = 'music.note.list' | 'mic.fill' | 'arrow.up.arrow.down';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => (
            <SymbolView name={'music.note.list' as TabIconName} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color }) => (
            <SymbolView name={'mic.fill' as TabIconName} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="transpose"
        options={{
          title: 'Transpose',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={'arrow.up.arrow.down' as TabIconName}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
