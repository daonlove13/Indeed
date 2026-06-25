import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { joinTeamByInviteCode } from '../services/api';
import { useTeam } from '../hooks/useData';

export default function JoinTeamPage() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [loading, setLoading] = useState(false);
  const { reload } = useTeam();
  const insets = useSafeAreaInsets();

  const handleJoin = async () => {
    if (code.trim().length < 4) return;
    setLoading(true);
    try {
      const result = await joinTeamByInviteCode(code.trim());
      if (result.ok) {
        await reload();
        router.replace('/(tabs)');
      } else {
        Alert.alert('합류 실패', result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={20} color="#6a7282" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>팀에{'\n'}합류하기</Text>
        <Text style={styles.subtitle}>팀장에게 받은 초대 코드를 입력해요</Text>

        <View style={[styles.inputBox, code.length > 0 && styles.inputBoxActive]}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            placeholder="초대 코드 입력"
            placeholderTextColor="#99a1af"
            maxLength={8}
            autoCapitalize="characters"
            autoFocus
          />
        </View>
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, (code.trim().length < 4 || loading) && styles.ctaBtnDisabled]}
          onPress={handleJoin}
          disabled={code.trim().length < 4 || loading}
        >
          {loading && <ActivityIndicator size="small" color="#99a1af" />}
          <Text style={[styles.ctaBtnText, (code.trim().length < 4 || loading) && styles.ctaBtnTextDisabled]}>
            합류하기
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 13, color: '#6a7282' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#0a0a0a', lineHeight: 34, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6a7282', marginBottom: 28 },
  inputBox: {
    borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 18,
  },
  inputBoxActive: { borderColor: '#000' },
  input: { fontSize: 28, fontWeight: '700', color: '#0a0a0a', letterSpacing: 6, textAlign: 'center' },
  cta: { paddingHorizontal: 24, paddingTop: 8, backgroundColor: '#fff' },
  ctaBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaBtnDisabled: { backgroundColor: '#e5e7eb' },
  ctaBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  ctaBtnTextDisabled: { color: '#99a1af' },
});
