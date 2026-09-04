import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { RaisedTabButton } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';

type TabIconName = 'folder.fill' | 'mic.fill' | 'arrow.up.arrow.down';

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
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          overflow: 'visible',
        },
        tabBarItemStyle: {
          overflow: 'visible',
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
            <SymbolView name={'folder.fill' as TabIconName} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <RaisedTabButton {...props} />,
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
