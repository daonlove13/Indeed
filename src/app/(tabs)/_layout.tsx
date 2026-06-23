import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useChats } from '../../hooks/useData';
import { useMemo } from 'react';

function TabIcon({ name, focused, badge }: { name: string; focused: boolean; badge?: number }) {
  return (
    <View style={styles.iconWrap}>
      <Feather
        name={name as any}
        size={22}
        color={focused ? '#000' : '#99a1af'}
        strokeWidth={focused ? 2.5 : 2}
      />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { chats } = useChats();
  const chatUnreadCount = useMemo(
    () => chats.active.reduce((sum, c) => sum + (c.unread ?? 0), 0),
    [chats],
  );
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 72 + insets.bottom, paddingBottom: insets.bottom }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: '#0a0a0a',
        tabBarInactiveTintColor: '#99a1af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="matching"
        options={{
          title: '매칭',
          tabBarIcon: ({ focused }) => <TabIcon name="heart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '채팅',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="message-circle" focused={focused} badge={chatUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: 'MY',
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#f3f4f6',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
