import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getPendingVerifications, getAdminReports, resolveReport,
} from '../../services/api';
import type { PendingUser, AdminReport } from '../../services/api';

type Tab = 'verify' | 'reports';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('verify');
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolveModal, setResolveModal] = useState<AdminReport | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([getPendingVerifications(), getAdminReports()]);
      setPending(p);
      setReports(r);
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleResolve = async (withPenalty: boolean) => {
    if (!resolveModal) return;
    setResolving(true);
    try {
      await resolveReport(
        resolveModal.id,
        adminNote,
        withPenalty && resolveModal.targetId
          ? { userId: resolveModal.targetId, level: 1, reason: adminNote }
          : undefined,
      );
      setResolveModal(null);
      setAdminNote('');
      load();
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setResolving(false);
    }
  };

  const pendingCount = pending.length;
  const unresolvedReports = reports.filter(r => r.status !== 'resolved').length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>관리자</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'verify' && styles.tabBtnActive]} onPress={() => setTab('verify')}>
          <Text style={[styles.tabText, tab === 'verify' && styles.tabTextActive]}>
            학생증 심사 {pendingCount > 0 && `(${pendingCount})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'reports' && styles.tabBtnActive]} onPress={() => setTab('reports')}>
          <Text style={[styles.tabText, tab === 'reports' && styles.tabTextActive]}>
            신고 접수 {unresolvedReports > 0 && `(${unresolvedReports})`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
      ) : tab === 'verify' ? (
        <FlatList
          data={pending}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={pending.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>대기 중인 심사가 없어요</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/admin/verify-detail' as never, params: { userId: item.id, name: item.name, department: item.department, cardUrl: item.studentCardUrl } })}
            >
              <View style={styles.cardAvatar}>
                <Text style={styles.cardAvatarText}>{item.name[0] ?? '?'}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.department} · {item.email}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#d1d5db" />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={reports.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>신고 내역이 없어요</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => { setResolveModal(item); setAdminNote(item.adminNote ?? ''); }}
            >
              <View style={[styles.statusDot, item.status === 'resolved' ? styles.dotResolved : styles.dotPending]} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={2}>{item.content || '내용 없음'}</Text>
                <Text style={styles.cardSub}>
                  {item.status === 'resolved' ? '처리 완료' : '처리 대기'} · {item.createdAt.slice(0, 10)}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#d1d5db" />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!resolveModal} transparent animationType="slide" onRequestClose={() => setResolveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>신고 처리</Text>
            <Text style={styles.modalContent}>{resolveModal?.content}</Text>
            <TextInput
              style={styles.modalInput}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="관리자 메모 (선택)"
              placeholderTextColor="#99a1af"
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setResolveModal(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, styles.btnWarn]} onPress={() => handleResolve(true)} disabled={resolving}>
                {resolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalActionText}>처리+패널티</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, styles.btnBlack]} onPress={() => handleResolve(false)} disabled={resolving}>
                {resolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalActionText}>처리만</Text>}
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
    height: 56, paddingHorizontal: 8, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0a0a0a' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#000' },
  tabText: { fontSize: 14, color: '#6a7282', fontWeight: '500' },
  tabTextActive: { color: '#000', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 8 },
  emptyText: { fontSize: 15, color: '#99a1af' },
  card: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f9fafb', gap: 12,
  },
  cardAvatar: {
    width: 40, height: 40, backgroundColor: '#000', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  cardAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0a0a0a' },
  cardSub: { fontSize: 12, color: '#6a7282', marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotPending: { backgroundColor: '#f59e0b' },
  dotResolved: { backgroundColor: '#10b981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 },
  modalContent: { fontSize: 14, color: '#374151', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 14 },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12,
    fontSize: 14, color: '#0a0a0a', minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6a7282' },
  modalActionBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalActionText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  btnWarn: { backgroundColor: '#ef4444' },
  btnBlack: { backgroundColor: '#000' },
});
