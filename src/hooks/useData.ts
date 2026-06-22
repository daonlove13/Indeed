import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/api';
import { supabase } from '../lib/supabase';
import type {
  UserProfile, Team, Stats, Restaurant, ChatList, Message, HistoryItem, Notification,
} from '../services/api';

const cache = new Map<string, unknown>();

function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = [], cacheKey?: string) {
  const cached = cacheKey ? (cache.get(cacheKey) as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(!cached);

  const load = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      if (cacheKey) cache.set(cacheKey, result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

export function useProfile() {
  const { data, loading, error, reload, setData } = useFetch<UserProfile>(api.getProfile, [], 'profile');
  const update = useCallback(async (partial: Partial<UserProfile>) => {
    const updated = await api.updateProfile(partial);
    setData(updated);
    return updated;
  }, [setData]);
  return { profile: data, loading, error, reload, update };
}

export function useTeam(onMatchDetected?: (teamId: string) => void) {
  const { data, loading, error, reload, setData } = useFetch<Team | null>(api.getTeam, [], 'team');
  const onMatchDetectedRef = useRef(onMatchDetected);
  onMatchDetectedRef.current = onMatchDetected;

  useEffect(() => {
    const ch = supabase.channel('team_members_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  useEffect(() => {
    const ch = supabase.channel('matches_insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' },
        async (payload) => {
          const match = payload.new as { team_a: string; team_b: string };
          const freshTeam = await api.getTeam();
          if (!freshTeam) return;
          reload();
          if (match.team_a === freshTeam.id || match.team_b === freshTeam.id) {
            onMatchDetectedRef.current?.(freshTeam.id);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  useEffect(() => {
    const ch = supabase.channel('teams_status_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' },
        async (payload) => {
          const updated = payload.new as { id: string; status: string };
          const freshTeam = await api.getTeam();
          if (!freshTeam || freshTeam.id !== updated.id) return;
          const newStatus = updated.status as 'waiting' | 'applied' | 'matched';
          setData(prev => {
            if (!prev || prev.id !== updated.id) return prev;
            return { ...prev, status: newStatus, applied: newStatus === 'applied' };
          });
          if (updated.status === 'matched') {
            onMatchDetectedRef.current?.(freshTeam.id);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [setData]);

  const create = useCallback(async (payload: Omit<Team, 'id' | 'createdAt'>) => {
    const team = await api.createTeam(payload);
    setData(team);
    return team;
  }, [setData]);

  const update = useCallback(async (team: Team) => {
    const updated = await api.updateTeam(team);
    setData(updated);
    return updated;
  }, [setData]);

  const remove = useCallback(async () => {
    await api.deleteTeam();
    setData(null);
  }, [setData]);

  const toggleApply = useCallback(async () => {
    const updated = await api.toggleApply();
    setData(updated);
    return updated;
  }, [setData]);

  return { team: data, loading, error, reload, create, update, remove, toggleApply };
}

export function useStats() { return useFetch<Stats>(api.getStats, [], 'stats'); }

export function useRestaurants() {
  const { data, loading, error, reload } = useFetch<Restaurant[]>(api.getRestaurants, [], 'restaurants');
  return { restaurants: data ?? [], loading, error, reload };
}

export function useChats() {
  const { data, loading, error, reload, setData } = useFetch<ChatList>(api.getChats, []);

  useEffect(() => {
    const channelName = `chats_matches_changes_${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => reload())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as { match_id: string; sender_id: string };
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user || newMsg.sender_id === user.id) { reload(); return; }
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              active: prev.active.map(c =>
                c.id === newMsg.match_id ? { ...c, unread: (c.unread ?? 0) + 1 } : c
              ),
            };
          });
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload, setData]);

  const markRead = useCallback(async (id: string | number) => {
    try {
      await api.markChatRead(id as number);
      setData(prev => prev ? {
        ...prev,
        active: prev.active.map(c => c.id === id ? { ...c, unread: 0 } : c),
      } : prev);
    } catch {}
  }, [setData]);

  const complete = useCallback(async (id: string | number) => {
    await api.completeChat(id as string);
    await reload();
  }, [reload]);

  return { chats: data ?? { active: [], done: [] }, loading, error, reload, markRead, complete, setData };
}

export function useMessages(chatId: string | number) {
  const { data, loading, error, reload, setData } = useFetch<Message[]>(
    () => api.getMessages(chatId), [chatId],
  );

  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; }, [reload]);

  useEffect(() => {
    const updateCh = supabase
      .channel(`msg_read:${chatId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as { id: string; read_by: string[] | null };
          const readBy = updated.read_by ?? [];
          setData(prev => {
            if (!prev) return prev;
            return prev.map(msg =>
              msg.dbId === String(updated.id)
                ? { ...msg, readCount: Math.max(readBy.length, msg.sender === 'me' ? 1 : 0) }
                : msg
            );
          });
        })
      .subscribe();

    let insertCh: ReturnType<typeof supabase.channel> | null = null;
    const myTeamMemberIdsRef = { current: new Set<string>() };

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const myUserId = user.id;

      const { data: myTeamRow } = await supabase.from('teams').select('id').eq('leader_id', myUserId).maybeSingle();
      if (myTeamRow?.id) {
        const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', myTeamRow.id);
        myTeamMemberIdsRef.current = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
      } else {
        const { data: memberRow } = await supabase.from('team_members').select('team_id').eq('user_id', myUserId).maybeSingle();
        if (memberRow?.team_id) {
          const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', memberRow.team_id);
          myTeamMemberIdsRef.current = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
        }
      }

      insertCh = supabase
        .channel(`msg_insert:${chatId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${chatId}` },
          async (payload) => {
            const m = payload.new as Record<string, unknown>;
            if (m.sender_id === myUserId) return;

            const { data: userData } = await supabase
              .from('users').select('name, department').eq('id', m.sender_id as string).maybeSingle();

            const senderName = userData
              ? (userData.department ? `${userData.department} ${userData.name}` : userData.name)
              : '상대';

            const iso = m.created_at as string;
            const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
            const timeStr = new Date(utc).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });

            const newMsg: Message = {
              id: Date.now(),
              dbId: String(m.id),
              text: (m.content as string) ?? '',
              sender: 'other',
              time: timeStr,
              senderName,
              isMyTeam: myTeamMemberIdsRef.current.has(m.sender_id as string),
              readCount: 0,
            };
            setData(prev => [...(prev ?? []), newMsg]);
          })
        .subscribe();
    });

    return () => {
      supabase.removeChannel(updateCh);
      if (insertCh) supabase.removeChannel(insertCh);
    };
  }, [chatId, setData]);

  const send = useCallback(async (msg: Omit<Message, 'id'>) => {
    const newMsg = await api.sendMessage(chatId, msg);
    setData(prev => [...(prev ?? []), newMsg]);
    return newMsg;
  }, [chatId, setData]);

  return { messages: data ?? [], loading, error, reload, send };
}

export function useHistory() {
  const { data, loading, error, reload } = useFetch<HistoryItem[]>(api.getHistory);
  return { history: data ?? [], loading, error, reload };
}

export function useNotifications() {
  const { data, loading, error, reload, setData } = useFetch<Notification[]>(api.getNotifications, []);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      ch = supabase.channel(`notifications_realtime_${user.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => { reload(); })
        .subscribe();
    });
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [reload]);

  const readAll = useCallback(async () => {
    setData(prev => prev ? prev.map(n => ({ ...n, read: true })) : prev);
    await api.markAllRead();
  }, [setData]);

  const markRead = useCallback(async (id: number) => {
    await api.markNotificationRead(id);
    setData(prev => prev ? prev.map(n => n.id === id ? { ...n, read: true } : n) : prev);
  }, [setData]);

  const unreadCount = (data ?? []).filter(n => !n.read).length;
  return { notifications: data ?? [], loading, error, reload, readAll, markRead, unreadCount };
}
