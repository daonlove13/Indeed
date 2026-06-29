import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProfile, useHistory, useNotifications } from '../../hooks/useData';
import { authSignOut, isPushEnabled, disablePush } from '../../services/api';
import { registerPushToken } from '../../lib/notifications';

export default function MyScreen() {
  const { profile, loading: profileLoading } = useProfile();
  const { history } = useHistory();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setPushEnabled);
  }, []);

  const initial = profile?.name?.[0] ?? '?';
  const recentHistory = history.slice(0, 2);

  const handleLogout = () => setLogoutModalVisible(true);

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    await authSignOut();
    router.replace('/splash');
  };

  const handlePushToggle = async (value: boolean) => {
    if (pushLoading) return;
    setPushEnabled(value);
    setPushLoading(true);
    try {
      if (!value) {
        await disablePush();
      } else {
        await registerPushToken();
      }
    } catch {
      setPushEnabled(!value);
    } finally {
      setPushLoading(false);
    }
  };

  type PressItem = { type: 'press'; label: string; onPress: () => void; danger?: boolean; admin?: boolean };
  type ToggleItem = { type: 'toggle'; label: string; value: boolean; onToggle: (v: boolean) => void; disabled?: boolean };
  type MenuItem = PressItem | ToggleItem;

  const menuItems: MenuItem[] = [
    ...(profile?.isAdmin ? [{ type: 'press' as const, label: '관리자 메뉴', onPress: () => router.push('/admin' as never), admin: true }] : []),
    { type: 'press', label: '과팅 내역', onPress: () => router.push('/history') },
    { type: 'toggle', label: '푸시 알림', value: pushEnabled, onToggle: handlePushToggle, disabled: pushLoading },
    { type: 'press', label: '알림 내역', onPress: () => router.push('/notifications') },
    { type: 'press', label: '이용약관', onPress: () => {} },
    { type: 'press', label: '개인정보처리방침', onPress: () => {} },
    { type: 'press', label: '로그아웃', onPress: handleLogout, danger: true },
  ];

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
        <Text style={styles.subHeaderTitle}>MY</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profileSection}>
          {profileLoading ? (
            <View style={styles.skeletonAvatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            {profileLoading ? (
              <>
                <View style={[styles.skeleton, { width: 80, height: 20 }]} />
                <View style={[styles.skeleton, { width: 140, height: 16, marginTop: 4 }]} />
              </>
            ) : (
              <>
                <Text style={styles.profileName}>{profile?.name}</Text>
                <Text style={styles.profileSub}>
                  {profile?.university} · {profile?.department}
                </Text>
                {(profile?.penalties ?? 0) > 0 && (
                  <View style={styles.penaltyBadge}>
                    <Text style={styles.penaltyText}>패널티 {profile?.penalties}회</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Recent History */}
        {recentHistory.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>최근 과팅</Text>
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={styles.seeAll}>전체보기</Text>
              </TouchableOpacity>
            </View>
            {recentHistory.map(item => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Feather name="heart" size={16} color="#fff" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>{item.name}</Text>
                  <Text style={styles.historyDate}>{item.date} · {item.place}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map((item, idx) => (
            item.type === 'toggle' ? (
              <View key={idx} style={styles.menuItem}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  disabled={item.disabled}
                  trackColor={{ false: '#e5e7eb', true: '#000' }}
                  thumbColor="#fff"
                />
              </View>
            ) : (
              <TouchableOpacity key={idx} style={styles.menuItem} onPress={item.onPress}>
                <Text style={[
                  styles.menuLabel,
                  item.danger && styles.menuLabelDanger,
                  item.admin && styles.menuLabelAdmin,
                ]}>
                  {item.label}
                </Text>
                <Feather name="chevron-right" size={16} color="#d1d5db" />
              </TouchableOpacity>
            )
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 로그아웃 확인 모달 */}
      <Modal visible={logoutModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            <Text style={styles.logoutTitle}>로그아웃</Text>
            <Text style={styles.logoutDesc}>로그아웃 하시겠어요?</Text>
            <View style={styles.logoutButtons}>
              <TouchableOpacity
                style={styles.logoutCancelBtn}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.logoutCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutConfirmBtn} onPress={confirmLogout}>
                <Text style={styles.logoutConfirmText}>로그아웃</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scroll: { flex: 1 },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 52, height: 52, backgroundColor: '#000', borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: '#fff' },
  skeletonAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#f3f4f6',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#0a0a0a' },
  profileSub: { fontSize: 12, color: '#6a7282', marginTop: 2 },
  penaltyBadge: {
    backgroundColor: '#fef2f2', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4,
  },
  penaltyText: { fontSize: 11, color: '#dc2626' },
  skeleton: { backgroundColor: '#f3f4f6', borderRadius: 6 },
  historySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0a0a0a' },
  seeAll: { fontSize: 13, color: '#6a7282' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  historyIcon: {
    width: 36, height: 36, backgroundColor: '#000', borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 14, fontWeight: '600', color: '#0a0a0a' },
  historyDate: { fontSize: 12, color: '#6a7282', marginTop: 2 },
  menuSection: { paddingTop: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  menuLabel: { fontSize: 15, color: '#0a0a0a' },
  menuLabelDanger: { color: '#e24b4a' },
  menuLabelAdmin: { color: '#2563eb', fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutModal: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, width: 280, alignItems: 'center',
  },
  logoutTitle: { fontSize: 17, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 },
  logoutDesc: { fontSize: 14, color: '#6a7282', marginBottom: 24 },
  logoutButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  logoutCancelBtn: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  logoutCancelText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
  logoutConfirmBtn: {
    flex: 1, backgroundColor: '#000', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  logoutConfirmText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
