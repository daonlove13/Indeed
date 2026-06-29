import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useChats, useNotifications } from '../../hooks/useData';
import type { ChatItem } from '../../services/api';

function getExpiryLabel(expiresAt?: string): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 1) return { label: `${days}일 후 종료`, urgent: false };
  if (days === 1) return { label: '내일 종료', urgent: true };
  return { label: `${hours}시간 후 종료`, urgent: true };
}

function ChatItemRow({ chat, onPress }: { chat: ChatItem; onPress: () => void }) {
  const expiry = getExpiryLabel(chat.expiresAt);

  return (
    <TouchableOpacity style={styles.chatRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.chatAvatar}>
        <Text style={styles.chatAvatarText}>{chat.initial}</Text>
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatInfoTop}>
          <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
          <Text style={styles.chatTime}>{chat.time}</Text>
        </View>
        <View style={styles.chatInfoBottom}>
          <Text style={styles.chatLastMsg} numberOfLines={1}>{chat.lastMessage}</Text>
          {(chat.unread ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{(chat.unread ?? 0) > 99 ? '99+' : chat.unread}</Text>
            </View>
          )}
          {chat.isMuted && <Feather name="bell-off" size={12} color="#9ca3af" />}
        </View>
        {expiry && (
          <Text style={[styles.expiryLabel, expiry.urgent && styles.expiryLabelUrgent]}>
            {expiry.label}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const { chats, loading, markRead } = useChats();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'active' | 'done'>('active');

  const displayList = activeTab === 'active' ? chats.active : chats.done;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Text style={styles.headerLogo}>indeed</Text>
        <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')}>
          <Feather name="bell" size={22} color="#000" />
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.subHeaderTitle}>채팅</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            진행 중 {chats.active.length > 0 && `(${chats.active.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'done' && styles.tabActive]}
          onPress={() => setActiveTab('done')}
        >
          <Text style={[styles.tabText, activeTab === 'done' && styles.tabTextActive]}>
            완료됨 {chats.done.length > 0 && `(${chats.done.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : displayList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>
            {activeTab === 'active' ? '진행 중인 채팅이 없어요' : '완료된 채팅이 없어요'}
          </Text>
          <Text style={styles.emptyDesc}>
            {activeTab === 'active' ? '매칭되면 여기서 채팅할 수 있어요' : '과팅을 완료하면 여기에 남아요'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ChatItemRow
              chat={item}
              onPress={() => {
                markRead(item.id);
                router.push({ pathname: '/chat-room', params: { id: String(item.id), name: item.name } });
              }}
            />
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
  headerLogo: { fontSize: 22, fontWeight: '700', color: '#000' },
  bellBtn: { padding: 8, position: 'relative' },
  bellDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, backgroundColor: '#000', borderRadius: 4,
  },
  subHeader: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  subHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 14, color: '#99a1af', fontWeight: '500' },
  tabTextActive: { color: '#0a0a0a', fontWeight: '700' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center' },
  chatRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  chatAvatar: {
    width: 48, height: 48, backgroundColor: '#000', borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  chatInfo: { flex: 1 },
  chatInfoTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { fontSize: 15, fontWeight: '600', color: '#0a0a0a', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, color: '#99a1af' },
  chatInfoBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatLastMsg: { fontSize: 13, color: '#6a7282', flex: 1 },
  unreadBadge: {
    backgroundColor: '#000', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    minWidth: 18, alignItems: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  expiryLabel: { fontSize: 11, color: '#6a7282', marginTop: 2 },
  expiryLabelUrgent: { color: '#f59e0b' },
});
