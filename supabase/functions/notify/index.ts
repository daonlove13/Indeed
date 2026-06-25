import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getTeamMemberIds(teamId: string): Promise<string[]> {
  const { data } = await db.from('team_members').select('user_id').eq('team_id', teamId);
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}

async function getExpoPushTokens(userIds: string[], excludeIds: string[] = [], mutedBy: string[] = []): Promise<string[]> {
  if (userIds.length === 0) return [];
  const targets = userIds.filter(id => !excludeIds.includes(id) && !mutedBy.includes(id));
  if (targets.length === 0) return [];

  const { data } = await db
    .from('push_subscriptions')
    .select('expo_push_token')
    .in('user_id', targets)
    .not('expo_push_token', 'is', null)
    .neq('expo_push_token', '');

  return (data ?? []).map((r: { expo_push_token: string }) => r.expo_push_token).filter(Boolean);
}

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map(to => ({ to, title, body, sound: 'default', data }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
}

async function saveNotification(userIds: string[], type: string, title: string, content: string): Promise<void> {
  if (userIds.length === 0) return;
  const rows = userIds.map(uid => ({ user_id: uid, type, title, content, is_read: false }));
  await db.from('notifications').insert(rows);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json() as { type: string; table: string; record: Record<string, unknown>; old_record?: Record<string, unknown> };

    // ── 학생증 인증 결과 ─────────────────────────────────────────────────────
    if (body.type === 'UPDATE' && body.table === 'users') {
      const record = body.record;
      const oldRecord = body.old_record;
      if (record.verified_status === oldRecord?.verified_status) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
      }

      const userId = String(record.id);
      const tokens = await getExpoPushTokens([userId]);

      if (record.verified_status === 'approved') {
        const title = '학생증 인증 완료! 🎉';
        const content = '인증이 승인됐어요. 지금 팀을 만들어 매칭에 참여해보세요!';
        await Promise.all([
          sendExpoPush(tokens, title, content, { type: 'verify', status: 'approved' }),
          saveNotification([userId], 'verify', title, content),
        ]);
      } else if (record.verified_status === 'rejected') {
        const title = '학생증 인증 불가';
        const content = '인증이 거부됐어요. 앱을 열어 사유를 확인해주세요.';
        await Promise.all([
          sendExpoPush(tokens, title, content, { type: 'verify', status: 'rejected' }),
          saveNotification([userId], 'verify', title, content),
        ]);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (body.type !== 'INSERT') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const record = body.record;

    // ── 매칭 성사 ────────────────────────────────────────────────────────────
    if (body.table === 'matches') {
      const [aIds, bIds] = await Promise.all([
        getTeamMemberIds(record.team_a as string),
        getTeamMemberIds(record.team_b as string),
      ]);
      const allIds = [...new Set([...aIds, ...bIds])];
      const tokens = await getExpoPushTokens(allIds);
      const matchId = String(record.id);
      const title = '매칭됐어요! 🎉';
      const content = '과팅 상대가 생겼어요. 지금 채팅을 시작해보세요!';
      await Promise.all([
        sendExpoPush(tokens, title, content, { type: 'match', matchId }),
        saveNotification(allIds, 'match', title, content),
      ]);
      return new Response(JSON.stringify({ ok: true, sent: tokens.length }), { status: 200 });
    }

    // ── 새 메시지 (push만, 알림 기록 저장 없음) ──────────────────────────────
    if (body.table === 'messages') {
      const matchId = record.match_id as string;
      const senderId = record.sender_id as string;
      const content = (record.content as string) ?? '새 메시지';

      const { data: matchRows } = await db
        .from('matches')
        .select('team_a, team_b, muted_by')
        .eq('id', matchId)
        .maybeSingle();

      if (!matchRows) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

      const { team_a, team_b, muted_by } = matchRows as { team_a: string; team_b: string; muted_by: string[] };
      const [aIds, bIds] = await Promise.all([getTeamMemberIds(team_a), getTeamMemberIds(team_b)]);
      const allIds = [...new Set([...aIds, ...bIds])];
      const tokens = await getExpoPushTokens(allIds, [senderId], muted_by ?? []);

      const preview = content.length > 40 ? content.slice(0, 40) + '...' : content;
      await sendExpoPush(tokens, '새 메시지가 왔어요 💬', preview, { type: 'message', matchId });
      return new Response(JSON.stringify({ ok: true, sent: tokens.length }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('notify error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
});
