import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';

type MCIcon = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(name: MCIcon) {
  return ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="insumos"
        options={{ title: 'Insumos', tabBarIcon: tabIcon('archive-outline') }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: tabIcon('view-dashboard-outline') }}
      />
      <Tabs.Screen
        name="movimentacao"
        options={{ title: 'Movimentação', tabBarIcon: tabIcon('truck-delivery-outline') }}
      />
    </Tabs>
  );
}
