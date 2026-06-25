import { supabase } from '../lib/supabase';

export interface UserProfile {
  name: string;
  university: string;
  department: string;
  gender: string;
  studentId: string;
  grade: string;
  penalties: number;
  verified: boolean;
  studentCardUrl?: string;
  isAdmin?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: '팀장' | '팀원';
  initial: string;
}

export interface Team {
  id: string;
  teamName: string;
  gender: '남성' | '여성';
  size: '2v2' | '3v3';
  members: TeamMember[];
  maxMembers: number;
  applied: boolean;
  status?: 'waiting' | 'applied' | 'matched';
  createdAt: string;
}

export interface Stats {
  todayApplications: number;
  maleWaiting: number;
  femaleWaiting: number;
  todayMatches: number;
  updatedAt: string;
}

export interface Restaurant {
  id: number;
  name: string;
  location: string;
  district: string;
  teamCount: number;
  seats: number;
  telephone?: string;
}

export interface ChatItem {
  id: string | number;
  name: string;
  initial: string;
  lastMessage: string;
  time: string;
  status: 'active' | 'done';
  unread?: number;
  expireWarning?: string;
  myTeamId?: string;
  totalMembers?: number;
  expiresAt?: string;
  isMuted?: boolean;
}

export interface ChatList {
  active: ChatItem[];
  done: ChatItem[];
}

export interface Message {
  id: number;
  text: string;
  sender: 'me' | 'other' | 'bot';
  time: string;
  senderName?: string;
  readCount?: number;
  isMyTeam?: boolean;
  dbId?: string;
}

export interface HistoryItem {
  id: number;
  name: string;
  date: string;
  place: string;
}

export interface Notification {
  id: number;
  type: 'match' | 'chat' | 'info' | 'verify';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function formatTime(iso: string): string {
  try {
    const utcStr = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    return new Date(utcStr).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    });
  } catch {
    return '';
  }
}

export async function authSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`로그인 오류: ${error.message}`);
  return data;
}

export async function authSignOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`로그아웃 오류: ${error.message}`);
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(): Promise<UserProfile> {
  const userId = await getCurrentUserId();
  if (!userId) return {
    name: '', university: '충북대학교', department: '', gender: '',
    studentId: '', grade: '1', penalties: 0, verified: false,
  };

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`프로필 조회 오류: ${error.message}`);

  if (!data) {
    return {
      name: '', university: '충북대학교', department: '', gender: '',
      studentId: '', grade: '1', penalties: 0, verified: false,
    };
  }

  return {
    name: data.name ?? '',
    university: '충북대학교',
    department: data.department ?? '',
    gender: data.gender ?? '',
    studentId: data.student_id ?? '',
    grade: data.grade ?? '1',
    penalties: data.penalties ?? 0,
    verified: data.verified ?? false,
    studentCardUrl: data.student_card_url ?? undefined,
    isAdmin: data.is_admin ?? false,
  };
}

export async function createUserProfile(profile: {
  name: string;
  department: string;
  gender: string;
  studentId?: string;
  phone?: string;
}): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: user?.email ?? null,
      name: profile.name,
      university: '충북대학교',
      department: profile.department,
      gender: profile.gender,
      student_id: profile.studentId ?? null,
      phone: profile.phone ?? null,
      verified: false,
      verified_status: 'pending',
    }, { onConflict: 'id' });

  if (error) throw new Error(`프로필 생성 오류: ${error.message}`);
}

export async function updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.department !== undefined) updates.department = data.department;
  if (data.gender !== undefined) updates.gender = data.gender;

  const { error } = await supabase.from('users').update(updates).eq('id', userId);
  if (error) throw new Error(`프로필 수정 오류: ${error.message}`);
  return getProfile();
}

export async function uploadStudentCard(uri: string, mimeType: string = 'image/jpeg'): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `${userId}/student-card.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('student-cards')
    .upload(path, blob, { upsert: true, contentType: mimeType });

  if (uploadError) throw new Error(`학생증 업로드 오류: ${uploadError.message}`);

  const { error: updateError } = await supabase
    .from('users')
    .update({ student_card_url: path })
    .eq('id', userId);

  if (updateError) throw new Error(`학생증 경로 저장 오류: ${updateError.message}`);

  // 재제출 시 심사 대기 상태로 초기화
  await supabase.from('users').update({ verified_status: 'pending', rejection_reason: null }).eq('id', userId);

  return path;
}

async function mapTeamRow(row: Record<string, unknown>, profile?: UserProfile): Promise<Team> {
  const p = profile ?? await getProfile();
  const sizeNum = typeof row.size === 'number' ? row.size : parseInt(String(row.size), 10);
  const size: '2v2' | '3v3' = sizeNum === 2 ? '2v2' : '3v3';

  let members: TeamMember[] = [];
  try {
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('user_id, role, users(name)')
      .eq('team_id', row.id);

    if (memberRows && memberRows.length > 0) {
      members = memberRows.map((m: Record<string, unknown>) => {
        const userName = (m.users as { name?: string } | null)?.name ?? '멤버';
        return {
          id: String(m.user_id),
          name: userName,
          role: (m.role as string) === 'leader' ? '팀장' : '팀원',
          initial: userName[0] ?? '?',
        };
      });
    }
  } catch {}

  if (members.length === 0) {
    members = [{ id: String(row.leader_id), name: p.name, role: '팀장', initial: p.name?.[0] ?? '나' }];
  }

  return {
    id: String(row.id),
    teamName: (row.team_name as string) ?? `${p.department} 팀`,
    gender: (row.gender as '남성' | '여성'),
    size,
    members,
    maxMembers: size === '2v2' ? 2 : 3,
    applied: (row.status as string) === 'applied',
    status: (row.status as 'waiting' | 'applied' | 'matched') ?? 'waiting',
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export async function getTeam(): Promise<Team | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data: leaderTeam, error: leaderError } = await supabase
      .from('teams').select('*').eq('leader_id', userId).maybeSingle();

    if (leaderError) throw leaderError;
    if (leaderTeam) return mapTeamRow(leaderTeam);

    const { data: memberRow } = await supabase
      .from('team_members').select('team_id').eq('user_id', userId).maybeSingle();

    if (!memberRow) return null;

    const { data: memberTeam, error: memberTeamError } = await supabase
      .from('teams').select('*').eq('id', memberRow.team_id).maybeSingle();

    if (memberTeamError) throw memberTeamError;
    if (!memberTeam) return null;

    return mapTeamRow(memberTeam);
  } catch {
    return null;
  }
}

export async function createTeam(payload: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const activeChatCount = await getActiveChatCount();
  if (activeChatCount >= 3) throw new Error('활성 채팅방이 3개예요. 과팅을 완료한 후 다시 시도해주세요.');

  const { data: oldTeam } = await supabase.from('teams').select('id, status').eq('leader_id', userId).maybeSingle();
  if (oldTeam?.id) {
    if (oldTeam.status === 'matched') {
      throw new Error('진행 중인 과팅이 있어요. 과팅을 완료한 후 팀을 재생성해주세요.');
    }
    await supabase.from('team_members').delete().eq('team_id', oldTeam.id);
    await supabase.from('teams').delete().eq('id', oldTeam.id);
  }

  const { data: userData } = await supabase
    .from('users').select('department, name').eq('id', userId).maybeSingle();

  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const insertData: Record<string, unknown> = {
    leader_id: userId,
    team_name: payload.teamName,
    department: userData?.department ?? '',
    gender: payload.gender,
    size: payload.size === '2v2' ? 2 : 3,
    status: 'waiting',
    created_at: new Date().toISOString(),
    invite_code: randomCode,
  };

  const { data, error } = await supabase.from('teams').insert(insertData).select().single();
  if (error) throw new Error(`팀 생성 오류: ${error.message}`);

  try {
    await supabase.from('team_members').insert({ team_id: data.id, user_id: userId, role: 'leader' });
  } catch {}

  return mapTeamRow(data);
}

export async function updateTeam(team: Team): Promise<Team> {
  const { error } = await supabase
    .from('teams')
    .update({ gender: team.gender, size: team.size === '2v2' ? 2 : 3, status: team.applied ? 'applied' : 'waiting' })
    .eq('id', team.id);

  if (error) throw new Error(`팀 수정 오류: ${error.message}`);
  return team;
}

export async function deleteTeam(): Promise<{ ok: boolean }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const { data: myTeam } = await supabase.from('teams').select('id').eq('leader_id', userId).maybeSingle();
  if (myTeam?.id) {
    await supabase.from('team_members').delete().eq('team_id', myTeam.id);
  }

  const { error } = await supabase.from('teams').delete().eq('leader_id', userId);
  if (error) throw new Error(`팀 삭제 오류: ${error.message}`);
  return { ok: true };
}

export async function toggleApply(): Promise<Team> {
  const team = await getTeam();
  if (!team) throw new Error('팀이 없습니다.');

  if (team.applied) {
    const { error } = await supabase.from('teams').update({ status: 'waiting' }).eq('id', team.id);
    if (error) throw new Error(`신청 취소 오류: ${error.message}`);
    return { ...team, applied: false, status: 'waiting' };
  }

  const { error } = await supabase.rpc('apply_and_match', { my_team_id: team.id });
  if (error) throw new Error(`신청 상태 변경 오류: ${error.message}`);

  // RPC가 매칭에 성공했을 수도 있으므로 DB에서 최신 상태 재조회
  const freshTeam = await getTeam();
  return freshTeam ?? { ...team, applied: true, status: 'applied' };
}

// ── 약속 확인 / 과팅 종료 (원자적 처리) ─────────────────────────────────────
//
// REQUIRED SQL (Supabase SQL Editor에 추가 필요):
//
// CREATE OR REPLACE FUNCTION toggle_meeting_confirmation(p_match_id uuid, p_user_id text)
// RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE v_arr text[]; v_confirmed boolean;
// BEGIN
//   SELECT meeting_confirmed_by INTO v_arr FROM matches WHERE id = p_match_id FOR UPDATE;
//   v_arr := COALESCE(v_arr, '{}');
//   IF p_user_id = ANY(v_arr) THEN
//     v_arr := array_remove(v_arr, p_user_id); v_confirmed := false;
//   ELSE
//     v_arr := array_append(v_arr, p_user_id); v_confirmed := true;
//   END IF;
//   UPDATE matches SET meeting_confirmed_by = v_arr WHERE id = p_match_id;
//   RETURN json_build_object('confirmed', v_confirmed, 'count', COALESCE(array_length(v_arr,1),0));
// END; $$;
//
// CREATE OR REPLACE FUNCTION toggle_dating_completion(p_match_id uuid, p_user_id text)
// RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE v_arr text[]; v_completed boolean;
// BEGIN
//   SELECT dating_completed_by INTO v_arr FROM matches WHERE id = p_match_id FOR UPDATE;
//   v_arr := COALESCE(v_arr, '{}');
//   IF p_user_id = ANY(v_arr) THEN
//     v_arr := array_remove(v_arr, p_user_id); v_completed := false;
//   ELSE
//     v_arr := array_append(v_arr, p_user_id); v_completed := true;
//   END IF;
//   UPDATE matches SET dating_completed_by = v_arr WHERE id = p_match_id;
//   RETURN json_build_object('completed', v_completed, 'count', COALESCE(array_length(v_arr,1),0));
// END; $$;

export async function toggleMeetingConfirmation(
  matchId: string,
): Promise<{ confirmed: boolean; count: number }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다.');
  const { data, error } = await supabase.rpc('toggle_meeting_confirmation', {
    p_match_id: matchId,
    p_user_id: userId,
  });
  if (error) throw new Error(`약속 확인 오류: ${error.message}`);
  return data as { confirmed: boolean; count: number };
}

export async function toggleDatingCompletion(
  matchId: string,
): Promise<{ completed: boolean; count: number }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다.');
  const { data, error } = await supabase.rpc('toggle_dating_completion', {
    p_match_id: matchId,
    p_user_id: userId,
  });
  if (error) throw new Error(`과팅 종료 처리 오류: ${error.message}`);
  return data as { completed: boolean; count: number };
}

export async function getStats(): Promise<Stats> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [
      { count: todayApplications },
      { count: maleWaiting },
      { count: femaleWaiting },
      { count: todayMatches },
    ] = await Promise.all([
      // NOTE: 오늘 생성된 팀 중 현재 applied 상태인 팀 수.
      // 정확한 "오늘 신청 수"를 위해서는 teams 테이블에 applied_at 컬럼이 필요합니다.
      supabase.from('teams').select('*', { count: 'exact', head: true }).eq('status', 'applied').gte('created_at', todayIso),
      supabase.from('teams').select('*', { count: 'exact', head: true }).eq('gender', '남성').eq('status', 'applied'),
      supabase.from('teams').select('*', { count: 'exact', head: true }).eq('gender', '여성').eq('status', 'applied'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),
    ]);

    return {
      todayApplications: todayApplications ?? 0,
      maleWaiting: maleWaiting ?? 0,
      femaleWaiting: femaleWaiting ?? 0,
      todayMatches: todayMatches ?? 0,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return { todayApplications: 0, maleWaiting: 0, femaleWaiting: 0, todayMatches: 0, updatedAt: new Date().toISOString() };
  }
}

export async function getRestaurants(): Promise<Restaurant[]> {
  return [];
}

export async function getChats(): Promise<ChatList> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { active: [], done: [] };

    const [{ data: ledTeams }, { data: memberRows }] = await Promise.all([
      supabase.from('teams').select('id, size').eq('leader_id', userId),
      supabase.from('team_members').select('team_id').eq('user_id', userId),
    ]);

    const teamIds = [
      ...((ledTeams ?? []).map(t => t.id)),
      ...((memberRows ?? []).map(r => r.team_id)),
    ].filter((v, i, a) => a.indexOf(v) === i);

    if (teamIds.length === 0) return { active: [], done: [] };

    const orFilter = teamIds.map(id => `team_a.eq.${id},team_b.eq.${id}`).join(',');
    const { data: matches, error } = await supabase
      .from('matches').select('*').or(orFilter).order('created_at', { ascending: false });

    if (error) throw error;
    if (!matches || matches.length === 0) return { active: [], done: [] };

    const currentTeam = await getTeam();
    const myTeamSizeMap = new Map((ledTeams ?? []).map(t => [t.id, t.size as number]));
    const allTeamIds = [...new Set(matches.flatMap(m => [m.team_a, m.team_b]))];

    const { data: allTeams } = await supabase
      .from('teams').select('id, team_name, department, leader_id, size').in('id', allTeamIds);

    const leaderIds = (allTeams ?? []).map(t => t.leader_id).filter(Boolean);
    const matchIds = matches.map(m => m.id);

    const [leaderUsersResult, lastMsgsResult] = await Promise.all([
      leaderIds.length > 0
        ? supabase.from('users').select('id, name').in('id', leaderIds)
        : Promise.resolve({ data: [] }),
      supabase.from('messages').select('match_id, content, created_at, read_by, sender_id')
        .in('match_id', matchIds).order('created_at', { ascending: false }).limit(300),
    ]);

    const leaderUsers = leaderUsersResult.data;
    const lastMsgs = lastMsgsResult.data;

    const lastMsgMap = new Map<string, { content: string; created_at: string }>();
    const unreadMap = new Map<string, number>();
    for (const msg of lastMsgs ?? []) {
      if (!lastMsgMap.has(msg.match_id)) {
        lastMsgMap.set(msg.match_id, { content: msg.content, created_at: msg.created_at });
      }
      const readBy = (msg.read_by ?? []).map((id: string) => id.trim().toLowerCase());
      const myId = userId.trim().toLowerCase();
      if (msg.sender_id !== userId && !readBy.includes(myId)) {
        unreadMap.set(msg.match_id, (unreadMap.get(msg.match_id) ?? 0) + 1);
      }
    }

    const teamMap = new Map((allTeams ?? []).map(t => [t.id, t]));
    const leaderMap = new Map((leaderUsers ?? []).map(u => [u.id, u]));

    const chatItems: ChatItem[] = matches.map(m => {
      const myTeamId = teamIds.includes(m.team_a) ? m.team_a : m.team_b;
      const otherTeamId = myTeamId === m.team_a ? m.team_b : m.team_a;
      const otherTeam = teamMap.get(otherTeamId);
      const leader = otherTeam?.leader_id ? leaderMap.get(otherTeam.leader_id) : null;
      const displayName = otherTeam?.team_name ?? (leader?.name ? `${leader.name} 팀` : '상대 팀');
      const lastMsg = lastMsgMap.get(m.id);
      const myTeamData = teamMap.get(myTeamId);
      const mySize = myTeamData?.size ?? myTeamSizeMap.get(myTeamId) ?? 3;
      const isExpired = m.expires_at && new Date(m.expires_at) < new Date();
      const status = (m.status === 'completed' || isExpired ? 'done' : 'active') as 'active' | 'done';

      return {
        id: m.id,
        myTeamId: currentTeam?.id ?? myTeamId,
        totalMembers: mySize * 2,
        name: displayName,
        initial: displayName[0] ?? '팀',
        lastMessage: lastMsg?.content ?? '매칭이 성사되었어요! 🎉',
        time: lastMsg?.created_at ? formatTime(lastMsg.created_at) : '',
        status,
        unread: unreadMap.get(m.id) ?? 0,
        expiresAt: m.expires_at ?? undefined,
        isMuted: (m.muted_by ?? []).includes(userId),
      };
    });

    return {
      active: chatItems.filter(c => c.status === 'active'),
      done: chatItems.filter(c => c.status === 'done'),
    };
  } catch {
    return { active: [], done: [] };
  }
}

export async function getActiveChatCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return 0;

    const { data: myLeaderTeams } = await supabase.from('teams').select('id').eq('leader_id', userId);
    const { data: myMemberTeams } = await supabase.from('team_members').select('team_id').eq('user_id', userId);

    const myTeamIds = [
      ...(myLeaderTeams ?? []).map(t => t.id),
      ...(myMemberTeams ?? []).map(t => t.team_id),
    ];

    if (myTeamIds.length === 0) return 0;

    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(myTeamIds.map(id => `team_a.eq.${id},team_b.eq.${id}`).join(','));

    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function toggleChatMute(matchId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;
    const { data: match } = await supabase.from('matches').select('muted_by').eq('id', matchId).maybeSingle();
    const mutedBy: string[] = match?.muted_by ?? [];
    let newMutedBy: string[];
    let isMuted: boolean;
    if (mutedBy.includes(userId)) {
      newMutedBy = mutedBy.filter(id => id !== userId);
      isMuted = false;
    } else {
      newMutedBy = [...mutedBy, userId];
      isMuted = true;
    }
    await supabase.from('matches').update({ muted_by: newMutedBy }).eq('id', matchId);
    return isMuted;
  } catch {
    return false;
  }
}

export async function completeChat(matchId: string | number): Promise<{ ok: boolean }> {
  try {
    await supabase.from('matches').update({ status: 'completed' }).eq('id', matchId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getMessages(chatId: string | number): Promise<Message[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    let myTeamMemberIds = new Set<string>();
    const { data: myTeamRow } = await supabase.from('teams').select('id').eq('leader_id', userId).maybeSingle();
    if (myTeamRow?.id) {
      const { data: tmMembers } = await supabase.from('team_members').select('user_id').eq('team_id', myTeamRow.id);
      myTeamMemberIds = new Set((tmMembers ?? []).map((m: { user_id: string }) => m.user_id));
    } else {
      const { data: memberRow } = await supabase.from('team_members').select('team_id').eq('user_id', userId).maybeSingle();
      if (memberRow?.team_id) {
        const { data: tmMembers } = await supabase.from('team_members').select('user_id').eq('team_id', memberRow.team_id);
        myTeamMemberIds = new Set((tmMembers ?? []).map((m: { user_id: string }) => m.user_id));
      }
    }

    const { data, error } = await supabase
      .from('messages').select('*, users(name, department)').eq('match_id', chatId).order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((m, i) => {
      const userInfo = m.users as { name?: string; department?: string } | null;
      const senderName = userInfo?.name ?? '상대';
      const dept = userInfo?.department ?? '';
      const isMe = m.sender_id === userId;
      const isMyTeam = !isMe && myTeamMemberIds.has(m.sender_id);
      const readBy = (m.read_by as string[] | null) ?? [];
      return {
        id: i + 1,
        dbId: String(m.id),
        text: m.content ?? '',
        sender: isMe ? 'me' : 'other',
        time: formatTime(m.created_at),
        senderName: isMe ? undefined : (dept ? `${dept} ${senderName}` : senderName),
        readCount: isMe ? Math.max(readBy.length, 1) : readBy.length,
        isMyTeam,
      };
    });
  } catch {
    return [];
  }
}

export async function markMessagesRead(chatId: string | number): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.rpc('mark_messages_read', { p_match_id: String(chatId), p_user_id: userId });
  } catch {}
}

export async function sendMessage(chatId: string | number, data: Omit<Message, 'id'>): Promise<Message> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const { data: inserted, error } = await supabase
    .from('messages').insert({ match_id: chatId, sender_id: userId, content: data.text }).select().single();

  if (error) throw new Error(`메시지 전송 오류: ${error.message}`);

  return {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    dbId: String(inserted.id),
    text: inserted.content,
    sender: 'me',
    time: formatTime(inserted.created_at),
    readCount: 1,
  };
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const team = await getTeam();
    if (!team) return [];

    const { data, error } = await supabase
      .from('matches').select('*')
      .or(`team_a.eq.${team.id},team_b.eq.${team.id}`).eq('status', 'completed');

    if (error) throw error;

    return (data ?? []).map((m, i) => ({
      id: i + 1,
      name: '매칭 완료',
      date: m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : '',
      place: '충북대 근처',
    }));
  } catch {
    return [];
  }
}

export async function getNotifications(): Promise<Notification[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('notifications').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(50);

    if (error) throw error;

    return (data ?? []).map(n => ({
      id: n.id,
      type: (n.type as 'match' | 'chat' | 'info' | 'verify') ?? 'info',
      title: n.title ?? '',
      body: n.content ?? '',
      time: formatTime(n.created_at),
      read: n.is_read ?? false,
    }));
  } catch {
    return [];
  }
}

export async function markAllRead(): Promise<Notification[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    return getNotifications();
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  } catch {}
}

export async function leaveTeam(): Promise<{ ok: boolean }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');

  const { data: myTeam } = await supabase.from('teams').select('id').eq('leader_id', userId).maybeSingle();

  if (myTeam) {
    const teamId = myTeam.id;
    const { data: nextMember } = await supabase
      .from('team_members').select('user_id').eq('team_id', teamId).neq('user_id', userId).limit(1).maybeSingle();

    if (nextMember) {
      await supabase.from('teams').update({ leader_id: nextMember.user_id }).eq('id', teamId);
      await supabase.from('team_members').update({ role: 'leader' }).eq('team_id', teamId).eq('user_id', nextMember.user_id);
      // team_id 범위로 한정하여 기존 팀장 삭제
      const { error } = await supabase.from('team_members').delete().eq('user_id', userId).eq('team_id', teamId);
      if (error) throw new Error(`팀 나가기 오류: ${error.message}`);
    } else {
      await supabase.from('team_members').delete().eq('team_id', teamId);
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw new Error(`팀 해체 오류: ${error.message}`);
    }
    return { ok: true };
  }

  // 팀원인 경우 — team_id를 먼저 조회하여 범위 한정 삭제
  const { data: memberRow } = await supabase
    .from('team_members').select('team_id').eq('user_id', userId).maybeSingle();

  if (!memberRow) return { ok: true };

  const { error } = await supabase.from('team_members').delete().eq('user_id', userId).eq('team_id', memberRow.team_id);
  if (error) throw new Error(`팀 나가기 오류: ${error.message}`);
  return { ok: true };
}

export async function getInviteInfo(): Promise<{ link: string; code: string } | null> {
  const team = await getTeam();
  if (!team) return null;

  const { data } = await supabase.from('teams').select('invite_code').eq('id', team.id).maybeSingle();
  const code = data?.invite_code ?? '';
  return { link: `indeed://join-team?code=${code}`, code };
}

export async function getTeamByInviteCode(code: string): Promise<Team | null> {
  try {
    const { data, error } = await supabase.from('teams').select('*').eq('invite_code', code.toUpperCase()).maybeSingle();
    if (error || !data) return null;
    return mapTeamRow(data);
  } catch {
    return null;
  }
}

// ── 신고 기능 ──────────────────────────────────────────────────────────────────

export async function submitReport(matchId: string | number, content: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('인증 정보가 없습니다.');
  const { error } = await supabase.from('reports').insert({
    reporter_id: userId,
    match_id: String(matchId),
    content,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

// ── 관리자 기능 ────────────────────────────────────────────────────────────────

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  department: string;
  studentCardUrl: string;
  createdAt: string;
}

export async function getPendingVerifications(): Promise<PendingUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, department, student_card_url, created_at')
    .eq('verified_status', 'pending')
    .not('student_card_url', 'is', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(u => ({
    id: String(u.id),
    name: u.name ?? '',
    email: u.email ?? '',
    department: u.department ?? '',
    studentCardUrl: u.student_card_url ?? '',
    createdAt: u.created_at ?? '',
  }));
}

export async function getStudentCardUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('student-cards').createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function approveUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ verified: true, verified_status: 'approved' })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function rejectUser(userId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ verified: false, verified_status: 'rejected', rejection_reason: reason })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export interface AdminReport {
  id: string;
  reporterId: string;
  targetId: string | null;
  matchId: string | null;
  content: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

export async function getAdminReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    id: String(r.id),
    reporterId: String(r.reporter_id),
    targetId: r.target_id ? String(r.target_id) : null,
    matchId: r.match_id ? String(r.match_id) : null,
    content: r.content ?? '',
    status: r.status ?? 'pending',
    adminNote: r.admin_note ?? null,
    createdAt: r.created_at ?? '',
  }));
}

export async function resolveReport(
  reportId: string,
  adminNote: string,
  penalty?: { userId: string; level: number; reason: string },
): Promise<void> {
  const { error } = await supabase
    .from('reports').update({ status: 'resolved', admin_note: adminNote }).eq('id', reportId);
  if (error) throw new Error(error.message);
  if (penalty) {
    const { error: pe } = await supabase.from('penalties').insert({
      user_id: penalty.userId, level: penalty.level, reason: penalty.reason,
    });
    if (pe) throw new Error(pe.message);
  }
}

export async function joinTeamByInviteCode(code: string): Promise<{ ok: boolean; message: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, message: '로그인이 필요합니다.' };

  const activeChatCount = await getActiveChatCount();
  if (activeChatCount >= 3) return { ok: false, message: '활성 채팅방이 3개예요.' };

  const myTeam = await getTeam();
  if (myTeam) return { ok: false, message: '이미 팀이 있어요. 먼저 팀을 해체해주세요.' };

  const { data: targetTeam, error } = await supabase
    .from('teams').select('*').eq('invite_code', code.toUpperCase()).maybeSingle();

  if (error || !targetTeam) return { ok: false, message: '유효하지 않은 코드예요.' };

  const maxMembers = targetTeam.size === 2 ? 2 : 3;
  const { count } = await supabase
    .from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', targetTeam.id);

  if ((count ?? 0) >= maxMembers) return { ok: false, message: '팀이 꽉 찼어요.' };

  const { data: myUser } = await supabase.from('users').select('gender, department').eq('id', userId).maybeSingle();
  if (myUser?.gender !== targetTeam.gender) return { ok: false, message: '성별이 맞지 않아요.' };
  if (myUser?.department !== targetTeam.department) return { ok: false, message: '같은 학과만 합류할 수 있어요.' };

  const { error: joinError } = await supabase.from('team_members').insert({ team_id: targetTeam.id, user_id: userId, role: 'member' });
  if (joinError) return { ok: false, message: `합류 오류: ${joinError.message}` };
  return { ok: true, message: '팀에 합류했어요!' };
}
