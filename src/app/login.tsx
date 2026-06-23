import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function KakaoIcon() {
  return (
    <View style={styles.kakaoIcon}>
      <Text style={{ fontSize: 18 }}>💬</Text>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <Text style={{ fontSize: 16 }}>G</Text>
    </View>
  );
}

async function navigateByUser(userId: string) {
  const { data: userData } = await supabase
    .from('users')
    .select('verified, student_card_url, name, verified_status')
    .eq('id', userId)
    .maybeSingle();

  if (!userData || !userData.name) {
    router.replace('/profile-setup');
    return;
  }

  if (userData.verified) {
    router.replace('/(tabs)');
  } else if (userData.verified_status === 'rejected') {
    router.replace('/rejected');
  } else if (userData.student_card_url) {
    router.replace('/pending');
  } else {
    router.replace('/student-id');
  }
}

function parseTokensFromUrl(url: string) {
  const hash = url.split('#')[1] ?? '';
  if (hash) {
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) return { accessToken, refreshToken };
  }
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(query);
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  };
}

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'kakao' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const appState = useRef(AppState.currentState);
  const insets = useSafeAreaInsets();

  const handleOAuthUrl = async (url: string) => {
    if (!url) return;
    if (!url.includes('access_token=') && !url.includes('refresh_token=') && !url.includes('code=')) return;

    const tokens = parseTokensFromUrl(url);
    if (tokens.accessToken && tokens.refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (!error && data.session) {
        await navigateByUser(data.session.user.id);
        return;
      }
    }

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (!error && data.session) {
        await navigateByUser(data.session.user.id);
      }
    } catch {}
  };

  useEffect(() => {
    Linking.getInitialURL().then(url => { if (url) handleOAuthUrl(url); });
    const linkSub = Linking.addEventListener('url', ({ url }) => handleOAuthUrl(url));

    const appSub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        setLoading(null);
      }
      appState.current = next;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await navigateByUser(session.user.id);
      }
    });

    return () => {
      linkSub.remove();
      appSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setLoading(provider);
    setErrorMsg('');
    try {
      const redirectTo = Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('OAuth URL을 받지 못했어요');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        await handleOAuthUrl(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        await new Promise(r => setTimeout(r, 600));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { await navigateByUser(session.user.id); return; }
        setErrorMsg('로그인이 취소됐어요.');
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setErrorMsg(errMsg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.logoSection}>
        <Text style={styles.logo}>indeed</Text>
        <Text style={styles.slogan}>같은 학교, 다른 학과</Text>
        <Text style={styles.slogan}>과팅의 새로운 방법</Text>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.buttonsArea}>
          <TouchableOpacity
            style={styles.kakaoButton}
            onPress={() => handleOAuth('kakao')}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'kakao' ? (
              <ActivityIndicator size="small" color="#3C1E1E" />
            ) : (
              <KakaoIcon />
            )}
            <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => handleOAuth('google')}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'google' ? (
              <ActivityIndicator size="small" color="#6a7282" />
            ) : (
              <GoogleIcon />
            )}
            <Text style={styles.googleButtonText}>Google로 시작하기</Text>
          </TouchableOpacity>

          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}
        </View>

        <View style={styles.terms}>
          <Text style={styles.termsText}>
            시작하면 <Text style={styles.termsLink}>이용약관</Text> 및{' '}
            <Text style={styles.termsLink}>개인정보처리방침</Text>에
          </Text>
          <Text style={styles.termsText}>동의하는 것으로 간주돼요</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 96,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -3,
    marginBottom: 20,
  },
  slogan: {
    fontSize: 14,
    color: '#6a7282',
    lineHeight: 22,
  },
  bottomSection: {
    paddingHorizontal: 35,
  },
  buttonsArea: {
    gap: 12,
    marginBottom: 20,
  },
  kakaoButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#FEE500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  kakaoIcon: {
    width: 24,
    alignItems: 'center',
  },
  kakaoButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3C1E1E',
  },
  googleButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: 12,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1e2939',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
  terms: {
    alignItems: 'center',
  },
  termsText: {
    fontSize: 11,
    color: '#99a1af',
    lineHeight: 18,
  },
  termsLink: {
    color: '#000',
  },
});
