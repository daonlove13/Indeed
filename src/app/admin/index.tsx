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
  getAdminReports, resolveReport, getReportDetail, adminWarnUser, adminSuspendUser,
} from '../../services/api';
import type { PendingUser, AdminReport, ReportDetail } from '../../services/api';

type Tab = 'verify' | 'reports';
type PenaltyType = 'none' | 'warn' | '3day' | '7day';

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
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const openResolveModal = async (item: AdminReport) => {
    setResolveModal(item);
    setAdminNote(item.adminNote ?? '');
    setReportDetail(null);
    setLoadingDetail(true);
    try {
      const detail = await getReportDetail(item);
      setReportDetail(detail);
    } catch {}
    finally { setLoadingDetail(false); }
  };

  const handleResolve = async (penaltyType: PenaltyType) => {
    if (!resolveModal) return;
    setResolving(true);
    try {
      await resolveReport(resolveModal.id, adminNote);
      if (penaltyType !== 'none' && resolveModal.targetId) {
        if (penaltyType === 'warn') {
          await adminWarnUser(resolveModal.targetId);
        } else if (penaltyType === '3day') {
          await adminSuspendUser(resolveModal.targetId, 3);
        } else if (penaltyType === '7day') {
          await adminSuspendUser(resolveModal.targetId, 7);
        }
      }
      setResolveModal(null);
      setAdminNote('');
      setReportDetail(null);
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
                onPress={() => openResolveModal(item)}
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

      {/* 신고 처리 모달 */}
      <Modal visible={!!resolveModal} transparent animationType="slide" onRequestClose={() => { setResolveModal(null); setReportDetail(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.adminModalBox, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>신고 처리</Text>

            <ScrollView style={styles.adminModalScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {/* 신고자 / 신고 대상 */}
              {loadingDetail && (
                <View style={styles.detailLoading}>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={styles.detailLoadingText}>상세 정보 불러오는 중...</Text>
                </View>
              )}
              {!loadingDetail && reportDetail && (
                <View style={styles.userInfoSection}>
                  <View style={styles.userChip}>
                    <Text style={styles.chipLabel}>신고자</Text>
                    <Text style={styles.chipValue}>
                      {reportDetail.reporterName}
                      {reportDetail.reporterDept ? ` · ${reportDetail.reporterDept}` : ''}
                    </Text>
                  </View>
                  {resolveModal?.targetId && (
                    <View style={[styles.userChip, { backgroundColor: '#fee2e2' }]}>
                      <Text style={[styles.chipLabel, { color: '#dc2626' }]}>신고 대상</Text>
                      <Text style={[styles.chipValue, { color: '#dc2626' }]}>
                        {reportDetail.targetName}
                        {reportDetail.targetDept ? ` · ${reportDetail.targetDept}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* 신고 내용 */}
              <Text style={styles.modalContent}>{resolveModal?.content || '내용 없음'}</Text>

              {/* 채팅 내역 */}
              {!loadingDetail && reportDetail && reportDetail.messages.length > 0 && (
                <View style={styles.chatPreviewSection}>
                  <Text style={styles.chatPreviewTitle}>
                    관련 채팅 내역 (최근 {Math.min(reportDetail.messages.length, 10)}개)
                  </Text>
                  {reportDetail.messages.slice(-10).map((msg, i) => (
                    <View key={i} style={styles.chatPreviewRow}>
                      <Text style={styles.chatPreviewSender}>{msg.senderName}</Text>
                      <Text style={styles.chatPreviewText} numberOfLines={3}>{msg.text}</Text>
                      <Text style={styles.chatPreviewTime}>{msg.time}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 관리자 메모 */}
              <TextInput
                style={styles.modalInput}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="관리자 메모 (선택)"
                placeholderTextColor="#99a1af"
                multiline
              />
            </ScrollView>

            {/* 처리 버튼 */}
            <View style={styles.penaltyRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setResolveModal(null); setReportDetail(null); }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminActionBtn, { backgroundColor: '#374151' }]}
                onPress={() => handleResolve('none')}
                disabled={resolving}
              >
                {resolving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.adminActionText}>처리만</Text>}
              </TouchableOpacity>
            </View>

            {resolveModal?.targetId && (
              <View style={[styles.penaltyRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.adminActionBtn, { backgroundColor: '#f59e0b' }]}
                  onPress={() => handleResolve('warn')}
                  disabled={resolving}
                >
                  <Text style={styles.adminActionText}>경고</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminActionBtn, { backgroundColor: '#ef4444' }]}
                  onPress={() => handleResolve('3day')}
                  disabled={resolving}
                >
                  <Text style={styles.adminActionText}>3일 정지</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminActionBtn, { backgroundColor: '#7f1d1d' }]}
                  onPress={() => handleResolve('7day')}
                  disabled={resolving}
                >
                  <Text style={styles.adminActionText}>7일 정지</Text>
                </TouchableOpacity>
              </View>
            )}
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
  adminModalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 16, maxHeight: '90%',
  },
  adminModalScroll: { maxHeight: 420, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 12 },
  detailLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  detailLoadingText: { fontSize: 13, color: '#6a7282' },
  userInfoSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  userChip: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: '#f3f4f6', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipLabel: { fontSize: 11, fontWeight: '700', color: '#6a7282' },
  chipValue: { fontSize: 12, fontWeight: '600', color: '#374151' },
  modalContent: {
    fontSize: 14, color: '#374151', backgroundColor: '#f9fafb',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  chatPreviewSection: {
    borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 14, overflow: 'hidden',
  },
  chatPreviewTitle: {
    fontSize: 12, fontWeight: '700', color: '#6a7282',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f9fafb',
  },
  chatPreviewRow: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
  },
  chatPreviewSender: { fontSize: 11, fontWeight: '700', color: '#374151', minWidth: 48 },
  chatPreviewText: { flex: 1, fontSize: 12, color: '#0a0a0a', lineHeight: 18 },
  chatPreviewTime: { fontSize: 10, color: '#99a1af' },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12,
    fontSize: 14, color: '#0a0a0a', minHeight: 80, textAlignVertical: 'top',
  },
  penaltyRow: { flexDirection: 'row', gap: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6a7282' },
  adminActionBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  adminActionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
