import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useProfile, useStats, useRestaurants, useChats, useTeam, useNotifications } from '../../hooks/useData';
import { leaveTeam } from '../../services/api';
import { supabase } from '../../lib/supabase';
import type { Team } from '../../services/api';


function ActiveMatchesBanner({ count, onPress }: { count: number; onPress: () => void }) {
  if (count === 0) return null;
  return (
    <TouchableOpacity style={styles.matchBanner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.matchBannerLeft}>
        <View style={styles.matchIcon}>
          <Feather name="message-circle" size={16} color="#fff" />
        </View>
        <View>
          <Text style={styles.matchBannerTitle}>진행 중인 과팅 {count}개</Text>
          <Text style={styles.matchBannerSub}>채팅 탭에서 확인해보세요</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color="#9ca3af" />
    </TouchableOpacity>
  );
}

function NoTeamCard({ name, university, department, onCreateTeam, onJoinTeam }: {
  name: string; university: string; department: string;
  onCreateTeam: () => void; onJoinTeam: () => void;
}) {
  return (
    <View style={styles.teamCard}>
      <Text style={styles.teamCardInfo}>{university} · {department} · {name}</Text>
      <Text style={styles.teamCardTitle}>팀이 없어요</Text>
      <Text style={styles.teamCardDesc}>같은 과 친구들이랑 팀 만들고{'\n'}과팅을 시작해보세요!</Text>
      <View style={styles.teamCardButtons}>
        <TouchableOpacity style={styles.teamCardBtnPrimary} onPress={onCreateTeam}>
          <Text style={styles.teamCardBtnPrimaryText}>팀 만들기</Text>
          <Feather name="chevron-right" size={14} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.teamCardBtnSecondary} onPress={onJoinTeam}>
          <Text style={styles.teamCardBtnSecondaryText}>코드 입력</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HasTeamCard({ team, isLeader, onInviteTeam, onToggleApply, onDeleteTeam, onLeaveTeam }: {
  team: Team; isLeader: boolean; onInviteTeam: () => void;
  onToggleApply: () => void; onDeleteTeam: () => void; onLeaveTeam: () => void;
}) {
  const isFull = team.members.length >= team.maxMembers;
  const isMatched = team.status === 'matched';

  return (
    <View style={styles.teamCard}>
      <View style={styles.teamNameRow}>
        <Text style={styles.teamName}>{team.teamName}</Text>
        {team.applied && !isMatched && (
          <View style={styles.waitingBadge}>
            <Text style={styles.waitingText}>대기중</Text>
          </View>
        )}
        {isMatched && (
          <View style={[styles.waitingBadge, styles.matchedBadge]}>
            <Text style={styles.waitingText}>매칭됨</Text>
          </View>
        )}
      </View>
      <View style={styles.membersRow}>
        <Feather name="users" size={14} color="rgba(255,255,255,0.6)" />
        <Text style={styles.membersInfo}>
          팀원 {team.members.length}/{team.maxMembers}명 · {team.gender} · {team.size === '2v2' ? '2:2' : '3:3'}
        </Text>
      </View>
      <View style={styles.memberChips}>
        {team.members.map((member) => (
          <View key={member.id} style={styles.memberChip}>
            <View style={styles.memberDot} />
            <Text style={styles.memberName}>{member.name}</Text>
            {member.role === '팀장' && <Text style={styles.memberRole}>팀장</Text>}
          </View>
        ))}
        {isLeader && !isFull && !isMatched && (
          <TouchableOpacity style={styles.inviteChip} onPress={onInviteTeam}>
            <Feather name="user-plus" size={11} color="rgba(255,255,255,0.5)" />
            <Text style={styles.inviteText}>초대하기</Text>
          </TouchableOpacity>
        )}
      </View>
      {isMatched ? (
        <TouchableOpacity style={styles.applyingBtn} onPress={() => router.push('/(tabs)/chat')}>
          <Text style={styles.applyingText}>매칭 완료 · 채팅 탭에서 확인하세요 →</Text>
        </TouchableOpacity>
      ) : isLeader ? (
        team.applied ? (
          <TouchableOpacity style={styles.applyingBtn} onPress={onToggleApply}>
            <Text style={styles.applyingText}>대기 중 · 탭하면 취소</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.applyBtn, !isFull && styles.applyBtnDisabled]}
              onPress={isFull ? onToggleApply : undefined}
              disabled={!isFull}
            >
              <Text style={[styles.applyBtnText, !isFull && styles.applyBtnTextDisabled]}>
                {isFull ? '과팅 신청하기' : `팀원 ${team.members.length}/${team.maxMembers}명 · 모집 중`}
              </Text>
              {isFull && <Feather name="chevron-right" size={14} color="#000" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.leaveBtn} onPress={onDeleteTeam}>
              <Text style={styles.leaveBtnText}>팀 해체</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <TouchableOpacity style={styles.applyingBtn} onPress={onLeaveTeam}>
          <Text style={styles.applyingText}>팀 나가기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { profile, loading: profileLoading, reload: reloadProfile } = useProfile();
  const { data: stats, loading: statsLoading, reload: reloadStats } = useStats();
  const { restaurants, loading: restLoading, reload: reloadRest } = useRestaurants();
  const { chats } = useChats();
  const { team, loading: teamLoading, reload: reloadTeam, remove: removeTeam, toggleApply } = useTeam();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!team) { setIsLeader(false); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const leaderMember = team.members.find(m => m.role === '팀장');
      setIsLeader(leaderMember?.id === user.id);
    });
  }, [team]);

  const activeMatchCount = chats.active.length;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reloadProfile(), reloadStats(), reloadRest(), reloadTeam()]);
    setRefreshing(false);
  };

  const handleDeleteTeam = () => {
    Alert.alert('팀 해체', '팀을 해체하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '해체', style: 'destructive',
        onPress: async () => {
          try {
            await removeTeam();
          } catch {
            Alert.alert('오류', '팀 해체에 실패했어요. 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const handleLeaveTeam = () => {
    Alert.alert('팀 나가기', '팀에서 나가시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기', style: 'destructive',
        onPress: async () => {
          try {
            await leaveTeam();
            await reloadTeam();
          } catch {
            Alert.alert('오류', '팀 나가기에 실패했어요. 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const statsData = [
    { value: stats?.maleWaiting ?? 0, label: '남자 신청' },
    { value: stats?.femaleWaiting ?? 0, label: '여자 신청' },
    { value: stats?.todayMatches ?? 0, label: '오늘 매칭' },
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ActiveMatchesBanner count={activeMatchCount} onPress={() => router.push('/(tabs)/chat')} />

        {teamLoading || profileLoading ? (
          <View style={[styles.skeleton, { height: 180 }]} />
        ) : team ? (
          <HasTeamCard
            team={team}
            isLeader={isLeader}
            onInviteTeam={() => router.push('/invite-link')}
            onToggleApply={async () => {
              try { await toggleApply(); }
              catch { Alert.alert('오류', '신청 상태 변경에 실패했어요. 다시 시도해주세요.'); }
            }}
            onDeleteTeam={handleDeleteTeam}
            onLeaveTeam={handleLeaveTeam}
          />
        ) : (
          <NoTeamCard
            name={profile?.name ?? ''}
            university={profile?.university ?? '충북대학교'}
            department={profile?.department ?? ''}
            onCreateTeam={() => router.push('/create-team')}
            onJoinTeam={() => router.push('/join-team')}
          />
        )}

        <View style={styles.statsRow}>
          {statsData.map((stat, idx) => (
            <View key={idx} style={styles.statItem}>
              <Text style={[styles.statValue, statsLoading && { opacity: 0.3 }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {restaurants.length > 0 && (
          <View style={styles.restaurantsSection}>
            <Text style={styles.sectionTitle}>근처 갈만한 식당</Text>
            <Text style={styles.sectionSub}>매칭되면 가기 좋은 학교 근처 가게들이에요</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
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
    backgroundColor: '#fff',
  },
  headerLogo: { fontSize: 22, fontWeight: '700', color: '#000' },
  bellBtn: { padding: 8, position: 'relative' },
  bellDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, backgroundColor: '#000', borderRadius: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  matchBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 14, padding: 12, marginBottom: 16,
  },
  matchBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchIcon: { width: 36, height: 36, backgroundColor: '#000', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  matchBannerTitle: { fontSize: 13, fontWeight: '700', color: '#0a0a0a' },
  matchBannerSub: { fontSize: 11, color: '#6a7282' },
  teamCard: { backgroundColor: '#000', borderRadius: 20, padding: 24, marginBottom: 16 },
  teamCardInfo: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  teamCardTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  teamCardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 20 },
  teamCardButtons: { flexDirection: 'row', gap: 8 },
  teamCardBtnPrimary: {
    flex: 1, backgroundColor: '#fff', borderRadius: 100,
    paddingVertical: 8, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  teamCardBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#000' },
  teamCardBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100,
    paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  teamCardBtnSecondaryText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  teamName: { fontSize: 22, fontWeight: '700', color: '#fff' },
  waitingBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4,
  },
  matchedBadge: { backgroundColor: 'rgba(34,197,94,0.35)' },
  waitingText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  membersInfo: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4,
  },
  memberDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  memberName: { fontSize: 12, color: '#fff' },
  memberRole: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  inviteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4,
  },
  inviteText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  applyingBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  applyingText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8 },
  applyBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 100, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  applyBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.2)' },
  applyBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
  applyBtnTextDisabled: { color: 'rgba(255,255,255,0.4)' },
  leaveBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  leaveBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 30, fontWeight: '700', color: '#000', lineHeight: 36 },
  statLabel: { fontSize: 12, color: '#6a7282', marginTop: 4 },
  restaurantsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#6a7282' },
  emptyText: { fontSize: 13, color: '#99a1af', textAlign: 'center', paddingVertical: 32 },
  skeleton: { backgroundColor: '#f3f4f6', borderRadius: 20, marginBottom: 16 },
});
