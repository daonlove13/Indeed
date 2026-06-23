import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTeam, useNotifications } from '../../hooks/useData';
import { getActiveChatCount, leaveTeam } from '../../services/api';
import { supabase } from '../../lib/supabase';

export default function MatchingScreen() {
  const { team, reload: reloadTeam, toggleApply } = useTeam();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [activeChatCount, setActiveChatCount] = useState(0);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    getActiveChatCount().then(setActiveChatCount);
  }, [team]);

  useEffect(() => {
    if (!team) { setIsLeader(false); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const leaderMember = team.members.find(m => m.role === '팀장');
      setIsLeader(leaderMember?.id === user.id);
    });
  }, [team]);

  const chatLimitReached = activeChatCount >= 3;

  const handleApply = async () => {
    if (!team || !isLeader || chatLimitReached) return;
    setSaving(true);
    try {
      await toggleApply();
      await reloadTeam();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelApply = async () => {
    try {
      await toggleApply();
      await reloadTeam();
    } catch {}
  };

  const handleLeaveTeam = () => {
    Alert.alert('팀 나가기', '팀에서 나가시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기', style: 'destructive',
        onPress: async () => {
          try { await leaveTeam(); await reloadTeam(); } catch {}
        },
      },
    ]);
  };

  const headerNode = (
    <View style={[styles.header, { marginTop: insets.top }]}>
      <Text style={styles.headerLogo}>indeed</Text>
      <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')}>
        <Feather name="bell" size={22} color="#000" />
        {unreadCount > 0 && <View style={styles.bellDot} />}
      </TouchableOpacity>
    </View>
  );

  const subHeaderNode = (
    <View style={styles.subHeader}>
      <Text style={styles.subHeaderTitle}>매칭</Text>
    </View>
  );

  if (!team) {
    return (
      <View style={styles.container}>
        {headerNode}
        {subHeaderNode}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>팀이 없어요</Text>
          <Text style={styles.emptyDesc}>먼저 홈에서 팀을 만들거나 합류해주세요</Text>
          <TouchableOpacity style={styles.goHomeBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.goHomeBtnText}>홈으로 가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {headerNode}
      {subHeaderNode}

      {team.status === 'matched' ? (
        <View style={styles.matchedContainer}>
          <View style={styles.matchedIcon}>
            <Feather name="check" size={32} color="#fff" />
          </View>
          <Text style={styles.matchedTitle}>매칭 완료!</Text>
          <Text style={styles.matchedDesc}>
            상대 팀과 연결됐어요.{'\n'}
            채팅 탭에서 대화를 시작해보세요!
          </Text>
          <TouchableOpacity style={styles.goToChatBtn} onPress={() => router.push('/(tabs)/chat')}>
            <Text style={styles.goToChatBtnText}>채팅하러 가기</Text>
            <Feather name="message-circle" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : team.applied ? (
        <View style={styles.waitingContainer}>
          <View style={styles.waitingIcon}>
            <Feather name="clock" size={32} color="#fff" />
          </View>
          <Text style={styles.waitingTitle}>매칭 대기 중이에요</Text>
          <Text style={styles.waitingDesc}>
            상대 팀이 나타나면 자동으로 매칭돼요.{'\n'}
            최대한 빨리 연결해드릴게요!
          </Text>
          {isLeader && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelApply}>
              <Text style={styles.cancelBtnText}>신청 취소하기</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.teamInfoCard}>
            <Text style={styles.teamInfoName}>{team.teamName}</Text>
            <View style={styles.teamInfoRow}>
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>{team.gender}</Text>
              </View>
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>{team.size === '2v2' ? '2:2' : '3:3'}</Text>
              </View>
            </View>
            <View style={styles.membersSection}>
              {team.members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{m.initial}</Text>
                  </View>
                  <Text style={styles.memberNameText}>{m.name}</Text>
                  <View style={[styles.roleBadge, m.role === '팀장' && styles.roleBadgeLeader]}>
                    <Text style={[styles.roleText, m.role === '팀장' && styles.roleTextLeader]}>
                      {m.role}
                    </Text>
                  </View>
                </View>
              ))}
              {Array.from({ length: team.maxMembers - team.members.length }).map((_, i) => (
                <View key={`empty-${i}`} style={[styles.memberRow, { opacity: 0.4 }]}>
                  <View style={[styles.memberAvatar, { backgroundColor: '#e5e7eb' }]}>
                    <Feather name="user" size={14} color="#99a1af" />
                  </View>
                  <Text style={[styles.memberNameText, { color: '#99a1af' }]}>팀원 모집 중</Text>
                </View>
              ))}
            </View>
          </View>

          {chatLimitReached && (
            <View style={styles.limitBanner}>
              <Feather name="alert-circle" size={16} color="#f59e0b" />
              <Text style={styles.limitText}>활성 채팅방이 3개예요. 과팅 완료 후 신청 가능해요.</Text>
            </View>
          )}

          {isLeader && (
            <TouchableOpacity
              style={[
                styles.applyBtn,
                (team.members.length < team.maxMembers || chatLimitReached || saving) && styles.applyBtnDisabled,
              ]}
              onPress={handleApply}
              disabled={team.members.length < team.maxMembers || chatLimitReached || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#999" />
              ) : (
                <>
                  <Text style={[
                    styles.applyBtnText,
                    (team.members.length < team.maxMembers || chatLimitReached) && styles.applyBtnTextDisabled,
                  ]}>
                    {team.members.length < team.maxMembers
                      ? `팀원 ${team.members.length}/${team.maxMembers}명 필요해요`
                      : '과팅 신청하기'}
                  </Text>
                  {team.members.length >= team.maxMembers && !chatLimitReached && (
                    <Feather name="heart" size={16} color="#fff" />
                  )}
                </>
              )}
            </TouchableOpacity>
          )}

          {!isLeader && (
            <View style={styles.memberOnlyBanner}>
              <Text style={styles.memberOnlyText}>팀장이 과팅을 신청할 수 있어요</Text>
            </View>
          )}

          <TouchableOpacity style={styles.leaveTeamBtn} onPress={handleLeaveTeam}>
            <Text style={styles.leaveTeamText}>팀 나가기</Text>
          </TouchableOpacity>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  subHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center', marginBottom: 24 },
  goHomeBtn: { backgroundColor: '#000', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  goHomeBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  matchedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  matchedIcon: {
    width: 72, height: 72, backgroundColor: '#000', borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  matchedTitle: { fontSize: 22, fontWeight: '700', color: '#0a0a0a', marginBottom: 12 },
  matchedDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  goToChatBtn: {
    backgroundColor: '#000', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  goToChatBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  waitingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  waitingIcon: {
    width: 72, height: 72, backgroundColor: '#000', borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  waitingTitle: { fontSize: 22, fontWeight: '700', color: '#0a0a0a', marginBottom: 12 },
  waitingDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  cancelBtn: {
    borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  teamInfoCard: { backgroundColor: '#f9fafb', borderRadius: 20, padding: 20, marginBottom: 16 },
  teamInfoName: { fontSize: 20, fontWeight: '700', color: '#0a0a0a', marginBottom: 12 },
  teamInfoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  infoBadge: { backgroundColor: '#e5e7eb', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  infoBadgeText: { fontSize: 12, fontWeight: '600', color: '#0a0a0a' },
  membersSection: { gap: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: {
    width: 32, height: 32, backgroundColor: '#000', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  memberNameText: { flex: 1, fontSize: 14, color: '#0a0a0a', fontWeight: '500' },
  roleBadge: { backgroundColor: '#f3f4f6', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeLeader: { backgroundColor: '#000' },
  roleText: { fontSize: 11, color: '#6a7282' },
  roleTextLeader: { color: '#fff' },
  limitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  limitText: { fontSize: 13, color: '#92400e', flex: 1 },
  applyBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 12,
  },
  applyBtnDisabled: { backgroundColor: '#e5e7eb' },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  applyBtnTextDisabled: { color: '#99a1af' },
  memberOnlyBanner: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  memberOnlyText: { fontSize: 13, color: '#6a7282' },
  leaveTeamBtn: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  leaveTeamText: { fontSize: 14, color: '#6a7282' },
});
