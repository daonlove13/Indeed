import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getPendingVerifications, getApprovedVerifications, getAdminReports, resolveReport,
} from '../../services/api';
import type { PendingUser, AdminReport } from '../../services/api';

type Tab = 'verify' | 'reports';

function formatSubmittedAt(iso?: string): string {
  if (!iso) return '';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    const d = new Date(utc);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return '방금 전';
    if (diffH < 24) return `${diffH}시간 전`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function isNewSubmission(iso?: string): boolean {
  if (!iso) return false;
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  return Date.now() - new Date(utc).getTime() < 6 * 3600 * 1000;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('verify');
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [approved, setApproved] = useState<PendingUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolveModal, setResolveModal] = useState<AdminReport | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a, r] = await Promise.all([
        getPendingVerifications(),
        getApprovedVerifications(),
        getAdminReports(),
      ]);
      setPending(p);
      setApproved(a);
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

  const unresolvedReports = reports.filter(r => r.status !== 'resolved').length;

  const navigateToDetail = (item: PendingUser) => {
    router.push({
      pathname: '/admin/verify-detail' as never,
      params: {
        userId: item.id,
        name: item.name,
        department: item.department,
        cardUrl: item.studentCardUrl,
      },
    });
  };

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
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'verify' && styles.tabBtnActive]}
          onPress={() => setTab('verify')}
        >
          <Text style={[styles.tabText, tab === 'verify' && styles.tabTextActive]}>
            학생증 심사 {pending.length > 0 && `(${pending.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'reports' && styles.tabBtnActive]}
          onPress={() => setTab('reports')}
        >
          <Text style={[styles.tabText, tab === 'reports' && styles.tabTextActive]}>
            신고 접수 {unresolvedReports > 0 && `(${unresolvedReports})`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
      ) : tab === 'verify' ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 승인 대기 섹션 */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>승인 대기</Text>
            <Text style={styles.sectionCount}>{pending.length}명</Text>
          </View>

          {pending.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>대기 중인 심사가 없어요</Text>
            </View>
          ) : (
            pending.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => navigateToDetail(item)}
              >
                <View style={styles.cardAvatar}>
                  <Text style={styles.cardAvatarText}>{item.name[0] ?? '?'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardNameRow}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {isNewSubmission(item.cardSubmittedAt) && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>신규</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSub}>
                    {item.department}
                    {item.cardSubmittedAt ? ` · ${formatSubmittedAt(item.cardSubmittedAt)}` : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#d1d5db" />
              </TouchableOpacity>
            ))
          )}

          {/* 승인 완료 섹션 */}
          <View style={[styles.sectionHeader, { marginTop: 16 }]}>
            <View style={[styles.sectionDot, styles.sectionDotApproved]} />
            <Text style={styles.sectionTitle}>승인 완료</Text>
            <Text style={styles.sectionCount}>{approved.length}명</Text>
          </View>

          {approved.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>최근 승인 내역이 없어요</Text>
            </View>
          ) : (
            approved.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, styles.cardApproved]}
                onPress={() => navigateToDetail(item)}
              >
                <View style={[styles.cardAvatar, styles.cardAvatarApproved]}>
                  <Text style={styles.cardAvatarText}>{item.name[0] ?? '?'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardNameRow}>
                    <Text style={[styles.cardName, { color: '#374151' }]}>{item.name}</Text>
                    <View style={styles.approvedBadge}>
                      <Feather name="check" size={10} color="#10b981" />
                      <Text style={styles.approvedBadgeText}>승인</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSub}>
                    {item.department}
                    {item.cardSubmittedAt ? ` · ${formatSubmittedAt(item.cardSubmittedAt)}` : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#d1d5db" />
              </TouchableOpacity>
            ))
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={reports.length === 0 ? styles.center : styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>신고 내역이 없어요</Text>
          ) : (
            reports.map(item => (
              <TouchableOpacity
                key={item.id}
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
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  scroll: { paddingVertical: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#f9fafb',
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
  sectionDotApproved: { backgroundColor: '#10b981' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },
  sectionCount: { fontSize: 12, color: '#6a7282' },
  emptyRow: { paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#99a1af' },
  card: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12,
  },
  cardApproved: { backgroundColor: '#fafafa' },
  cardAvatar: {
    width: 40, height: 40, backgroundColor: '#000', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  cardAvatarApproved: { backgroundColor: '#6b7280' },
  cardAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0a0a0a' },
  cardSub: { fontSize: 12, color: '#6a7282' },
  newBadge: {
    backgroundColor: '#fef3c7', borderRadius: 100,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  newBadgeText: { fontSize: 10, fontWeight: '700', color: '#d97706' },
  approvedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#d1fae5', borderRadius: 100,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  approvedBadgeText: { fontSize: 10, fontWeight: '700', color: '#10b981' },
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
