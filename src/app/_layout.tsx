import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { supabase } from '../lib/supabase';
import { registerPushToken } from '../lib/notifications';

function navigateFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Record<string, string> | undefined;
  if (!data) return;
  if (data.type === 'message' && data.matchId) {
    router.push({ pathname: '/chat-room', params: { id: data.matchId, name: '채팅' } });
  } else if (data.type === 'match') {
    router.push('/(tabs)/chat');
  } else if (data.type === 'verify') {
    if (data.status === 'approved') router.replace('/(tabs)');
    else if (data.status === 'rejected') router.replace('/rejected');
  }
}

export default function RootLayout() {
  const registered = useRef(false);

  // Check for OTA updates on every launch and apply immediately
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !registered.current) {
        registered.current = true;
        registerPushToken().catch(console.error);
      }
      if (event === 'SIGNED_OUT') {
        registered.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // 앱이 백그라운드/종료 상태에서 알림 탭 시 이동
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) navigateFromNotification(response);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(navigateFromNotification);
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="student-id" />
        <Stack.Screen name="pending" />
        <Stack.Screen name="rejected" />
        <Stack.Screen name="approval-complete" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat-room" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="create-team" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="invite-link" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="match-success" options={{ animation: 'fade' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin" options={{ animation: 'slide_from_right', headerShown: false }} />
      </Stack>
    </>
  );
}
