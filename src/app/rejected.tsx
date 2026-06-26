import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function RejectedScreen() {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      supabase.from('users').select('rejection_reason').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          setReason(data?.rejection_reason ?? null);
          setLoading(false);
        });
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Feather name="x" size={40} color="#fff" />
        </View>
        <Text style={styles.title}>인증이 반려됐어요</Text>

        {loading ? (
          <ActivityIndicator size="small" color="#99a1af" style={{ marginTop: 16 }} />
        ) : reason ? (
          <View style={styles.reasonBox}>
            <Feather name="alert-circle" size={14} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.reasonLabel}>반려 사유</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.desc}>
            학생증 사진을 다시 확인해주세요.{'\n'}
            이름, 학번, 학교명이 모두 보여야 해요.
          </Text>
        )}

        <Text style={styles.guide}>
          이름, 학번, 학교명이 선명하게 보이는{'\n'}
          사진을 다시 제출해주세요.
        </Text>
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/student-id')}>
          <Text style={styles.btnText}>다시 제출하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0a0a0a', marginBottom: 16, textAlign: 'center' },
  reasonBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fef2f2', borderRadius: 14, padding: 16,
    width: '100%', marginBottom: 16,
  },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: '#ef4444', marginBottom: 4 },
  reasonText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  desc: { fontSize: 14, color: '#6a7282', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  guide: { fontSize: 13, color: '#99a1af', textAlign: 'center', lineHeight: 20 },
  cta: { paddingHorizontal: 30, paddingTop: 8 },
  btn: { backgroundColor: '#000', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
