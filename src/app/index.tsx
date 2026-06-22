import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Index() {
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (mounted) router.replace('/splash');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('verified, student_card_url, name, verified_status')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

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
      } catch {
        if (mounted) router.replace('/splash');
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && mounted) {
        router.replace('/splash');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>indeed</Text>
      <ActivityIndicator size="small" color="#000" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    fontSize: 48,
    color: '#000',
    fontWeight: '700',
    letterSpacing: -1,
  },
  spinner: {
    marginTop: 16,
  },
});
