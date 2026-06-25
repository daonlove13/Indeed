import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getPendingVerifications, getApprovedVerifications, getRejectedVerifications,
  getAdminReports, resolveReport,
} from '../../services/api';
import type { PendingUser, AdminReport } from '../../services/api';

type Tab = 'verify' | 'reports';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    const diffMs = Date.now() - new Date(utc).getTime();
    const h = Math.floor(diffMs / 3600000);
    if (h < 1) return '방금 전';
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(utc).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch { return ''; }
}

function isNew(iso?: string): boolean {
  if (!iso) return false;
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  return Date.now() - new Date(utc).getTime() < 6 * 3600 * 1000;
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}명</Text>
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('verify');
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [approved, setApproved] = useState<PendingUser[]>([]);
  const [rejected, setRejected] = useState<PendingUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolveModal, setResolveModal] = useState<AdminReport | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a, r, rpts] = await Promise.all([
        getPendingVerifications(),
        getApprovedVerifications(),
        getRejectedVerifications(),
        getAdminReports(),
      ]);
      setPending(p);
      setApproved(a);
      setRejected(r);
      setReports(rpts);
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
        resolveModal.id, adminNote,
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

  const goDetail = (item: PendingUser) => {
    router.push({
      pathname: '/admin/verify-detail' as never,
      params: {
        userId: item.id,
        name: item.name,
        department: item.department,
        cardUrl: item.studentCardUrl,
        status: item.status,
        rejectionReason: item.rejectionReason ?? '',
      },
    });
  };

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
            학생증 심사 {pending.length > 0 && `(${pending.length})`}
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* ── 승인 대기 ── */}
          <SectionHeader title="승인 대기" count={pending.length} color="#f59e0b" />
          {pending.length === 0
            ? <EmptyRow text="대기 중인 심사가 없어요" />
            : pending.map(item => (
              <TouchableOpacity key={item.id} style={styles.card} onPress={() => goDetail(item)}>
                <View style={styles.cardAvatar}>
                  <Text style={styles.avatarText}>{item.name[0] ?? '?'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {isNew(item.cardSubmittedAt) && (
                      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.badgeText, { color: '#d97706' }]}>신규</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSub}>
                    {item.department}{item.cardSubmittedAt ? ` · ${relativeTime(item.cardSubmittedAt)}` : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#d1d5db" />
              </TouchableOpacity>
            ))
          }

          {/* ── 승인 완료 ── */}
          <View style={{ marginTop: 8 }}>
            <SectionHeader title="승인 완료" count={approved.length} color="#10b981" />
            {approved.length === 0
              ? <EmptyRow text="승인 완료 내역이 없어요" />
              : approved.map(item => (
                <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: '#fafafa' }]} onPress={() => goDetail(item)}>
                  <View style={[styles.cardAvatar, { backgroundColor: '#6b7280' }]}>
                    <Text style={styles.avatarText}>{item.name[0] ?? '?'}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.cardName, { color: '#374151' }]}>{item.name}</Text>
                      <View style={[styles.badge, { backgroundColor: '#d1fae5', flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
                        <Feather name="check" size={10} color="#10b981" />
                        <Text style={[styles.badgeText, { color: '#10b981' }]}>승인</Text>
                      </View>
                    </View>
                    <Text style={styles.cardSub}>
                      {item.department}{item.cardSubmittedAt ? ` · ${relativeTime(item.cardSubmittedAt)}` : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#d1d5db" />
                </TouchableOpacity>
              ))
            }
          </View>

          {/* ── 반려 ── */}
          <View style={{ marginTop: 8 }}>
            <SectionHeader title="반려" count={rejected.length} color="#ef4444" />
            {rejected.length === 0
              ? <EmptyRow text="반려 내역이 없어요" />
              : rejected.map(item => (
                <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: '#fafafa' }]} onPress={() => goDetail(item)}>
                  <View style={[styles.cardAvatar, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.avatarText}>{item.name[0] ?? '?'}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.cardName, { color: '#374151' }]}>{item.name}</Text>
                      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.badgeText, { color: '#ef4444' }]}>반려</Text>
                      </View>
                    </View>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.rejectionReason ? `사유: ${item.rejectionReason}` : item.department}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#d1d5db" />
                </TouchableOpacity>
              ))
            }
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={reports.length === 0 ? styles.center : styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {reports.length === 0
            ? <Text style={styles.emptyText}>신고 내역이 없어요</Text>
            : reports.map(item => (
              <TouchableOpacity
                key={item.id} style={styles.card}
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
          }
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={!!resolveModal} transparent animationType="slide" onRequestClose={() => setResolveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>신고 처리</Text>
            <Text style={styles.modalContent}>{resolveModal?.content}</Text>
            <TextInput
              style={styles.modalInput} value={adminNote} onChangeText={setAdminNote}
              placeholder="관리자 메모 (선택)" placeholderTextColor="#99a1af" multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setResolveModal(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleResolve(true)} disabled={resolving}>
                {resolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalActionText}>처리+패널티</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#000' }]} onPress={() => handleResolve(false)} disabled={resolving}>
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
  scroll: { paddingBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f9fafb',
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },
  sectionCount: { fontSize: 12, color: '#6a7282' },
  emptyRow: { paddingVertical: 18, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#99a1af' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12,
  },
  cardAvatar: {
    width: 40, height: 40, backgroundColor: '#000', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0a0a0a' },
  cardSub: { fontSize: 12, color: '#6a7282' },
  badge: { borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
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
});
