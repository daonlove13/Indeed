import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import StudentIdPage from './student-id';

export default function PendingScreen() {
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('users')
        .select('verified, verified_status, rejection_reason')
        .eq('id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (data?.verified_status === 'approved' || data?.verified === true) {
        router.replace('/(tabs)');
        return;
      } else if (data?.verified_status === 'rejected') {
        router.replace('/rejected');
        return;
      }

      const channel = supabase
        .channel(`pending_user_watch_${instanceId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
          (payload) => {
            if (!mounted) return;
            const u = payload.new as { verified?: boolean; verified_status?: string };
            if (u.verified_status === 'approved' || u.verified === true) {
              router.replace('/(tabs)');
            } else if (u.verified_status === 'rejected') {
              router.replace('/rejected');
            }
          })
        .subscribe();

      const interval = setInterval(async () => {
        const { data: d } = await supabase
          .from('users').select('verified, verified_status')
          .eq('id', user.id).maybeSingle();
        if (!mounted) return;
        if (d?.verified_status === 'approved' || d?.verified === true) router.replace('/(tabs)');
        else if (d?.verified_status === 'rejected') router.replace('/rejected');
      }, 30000);

      cleanup = () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    };

    init();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  return <StudentIdPage defaultState="pending" />;
}
