import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '../hooks/useData';
import type { Notification } from '../services/api';

function NotifIcon({ type }: { type: Notification['type'] }) {
  const icons: Record<string, string> = {
    match: 'heart',
    chat: 'message-circle',
    info: 'info',
    verify: 'check-circle',
  };
  return (
    <View style={[styles.notifIcon, type === 'match' && styles.notifIconMatch]}>
      <Feather name={icons[type] as any ?? 'bell'} size={18} color="#fff" />
    </View>
  );
}

export default function NotificationsPage() {
  const { notifications, loading, readAll, markRead } = useNotifications();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={20} color="#6a7282" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        <TouchableOpacity onPress={readAll} style={styles.readAllBtn}>
          <Text style={styles.readAllText}>모두 읽기</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>알림이 없어요</Text>
          <Text style={styles.emptyDesc}>새로운 알림이 오면 여기서 확인해요</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifItem, !item.read && styles.notifItemUnread]}
              onPress={() => markRead(item.id)}
            >
              <NotifIcon type={item.type} />
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.notifTime}>{item.time}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { fontSize: 13, color: '#6a7282' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0a0a0a' },
  readAllBtn: { width: 60, alignItems: 'flex-end' },
  readAllText: { fontSize: 13, color: '#6a7282' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center' },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  notifItemUnread: { backgroundColor: '#fafafa' },
  notifIcon: {
    width: 40, height: 40, backgroundColor: '#000', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  notifIconMatch: { backgroundColor: '#e24b4a' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#0a0a0a', marginBottom: 4 },
  notifBody: { fontSize: 13, color: '#6a7282', lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#99a1af' },
  unreadDot: {
    width: 8, height: 8, backgroundColor: '#000', borderRadius: 4, marginTop: 6,
  },
});
