import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(): Promise<string | null> {
  // 실제 디바이스에서만 동작 (에뮬레이터 제외)
  if (!Device.isDevice) {
    console.log('[Push] 실제 디바이스가 아니므로 토큰 등록 건너뜀');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] 알림 권한 거부됨');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: '4ca294a5-b95c-4c89-86de-5473ea252567',
    });
    token = result.data;
  } catch (e) {
    console.error('[Push] 토큰 발급 실패 — EAS FCM 자격증명 미설정 또는 네트워크 오류:', e);
    return null;
  }

  console.log('[Push] 토큰 발급 성공:', token);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return token;

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, expo_push_token: token }, { onConflict: 'user_id' });

  if (error) {
    console.error('[Push] 토큰 저장 실패:', error.message);
  } else {
    console.log('[Push] 토큰 DB 저장 완료');
  }

  return token;
}
