import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';

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
    .not('expo_push_token', 'is', null);

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
  }

  // Validate webhook secret
  const authHeader = req.headers.get('authorization') ?? '';
  if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json() as { type: string; table: string; record: Record<string, unknown> };

    if (body.type === 'UPDATE' && body.table === 'users') {
      const record = body.record as Record<string, unknown>;
      const oldRecord = (body as Record<string, unknown>).old_record as Record<string, unknown> | undefined;
      if (record.verified_status !== oldRecord?.verified_status) {
        const tokens = await getExpoPushTokens([String(record.id)]);
        if (record.verified_status === 'approved') {
          await sendExpoPush(tokens, '학생증 인증 완료! 🎉', '인증이 승인됐어요. 지금 팀을 만들어 매칭에 참여해보세요!', { type: 'verify', status: 'approved' });
        } else if (record.verified_status === 'rejected') {
          await sendExpoPush(tokens, '학생증 인증 불가', '인증이 거부됐어요. 앱을 열어 사유를 확인해주세요.', { type: 'verify', status: 'rejected' });
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (body.type !== 'INSERT') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const record = body.record;

    if (body.table === 'matches') {
      const [aIds, bIds] = await Promise.all([
        getTeamMemberIds(record.team_a as string),
        getTeamMemberIds(record.team_b as string),
      ]);
      const allIds = [...new Set([...aIds, ...bIds])];
      const tokens = await getExpoPushTokens(allIds);
      const matchId = String(record.id);
      await sendExpoPush(tokens, '매칭됐어요! 🎉', '과팅 상대가 생겼어요. 지금 채팅을 시작해보세요!', { type: 'match', matchId });
      return new Response(JSON.stringify({ ok: true, sent: tokens.length }), { status: 200 });
    }

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
