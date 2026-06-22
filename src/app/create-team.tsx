import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTeam } from '../hooks/useData';

export default function CreateTeamPage() {
  const [teamName, setTeamName] = useState('');
  const [gender, setGender] = useState<'남성' | '여성' | null>(null);
  const [size, setSize] = useState<'2v2' | '3v3' | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { create } = useTeam();

  const isValid = teamName.trim().length >= 2 && gender !== null && size !== null;

  const handleCreate = async () => {
    if (!isValid || !gender || !size) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await create({
        teamName: teamName.trim(),
        gender,
        size,
        members: [],
        maxMembers: size === '2v2' ? 2 : 3,
        applied: false,
      });
      router.replace('/invite-link');
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={20} color="#6a7282" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>팀을{'\n'}만들어보세요</Text>
        <Text style={styles.subtitle}>팀 이름과 정보를 설정하고 친구를 초대해요</Text>

        <Text style={styles.label}>팀 이름</Text>
        <View style={[styles.inputBox, teamName.length >= 2 && styles.inputBoxActive]}>
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="예) 컴공 팀장"
            placeholderTextColor="#99a1af"
            maxLength={12}
          />
          <Text style={styles.charCount}>{teamName.length}/12</Text>
        </View>

        <Text style={styles.label}>성별</Text>
        <View style={styles.optionRow}>
          {(['남성', '여성'] as const).map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.optionBtn, gender === g && styles.optionBtnActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.optionText, gender === g && styles.optionTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>인원</Text>
        <View style={styles.optionRow}>
          {(['2v2', '3v3'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.optionBtn, size === s && styles.optionBtnActive]}
              onPress={() => setSize(s)}
            >
              <Text style={[styles.optionText, size === s && styles.optionTextActive]}>
                {s === '2v2' ? '2:2 (2명)' : '3:3 (3명)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, (!isValid || loading) && styles.ctaBtnDisabled]}
          onPress={handleCreate}
          disabled={!isValid || loading}
        >
          {loading && <ActivityIndicator size="small" color="#99a1af" />}
          <Text style={[styles.ctaBtnText, (!isValid || loading) && styles.ctaBtnTextDisabled]}>
            팀 만들기
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56, marginTop: 44, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 13, color: '#6a7282' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#0a0a0a', lineHeight: 34, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6a7282', marginBottom: 28 },
  label: { fontSize: 12, fontWeight: '600', color: '#0a0a0a', marginBottom: 8 },
  inputBox: {
    borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  inputBoxActive: { borderColor: '#000' },
  input: { flex: 1, fontSize: 15, color: '#0a0a0a' },
  charCount: { fontSize: 12, color: '#99a1af' },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  optionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center',
  },
  optionBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  optionText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
  optionTextActive: { color: '#fff' },
  errorBox: {
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  errorText: { fontSize: 12, color: '#dc2626', lineHeight: 18 },
  cta: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8, backgroundColor: '#fff' },
  ctaBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaBtnDisabled: { backgroundColor: '#e5e7eb' },
  ctaBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  ctaBtnTextDisabled: { color: '#99a1af' },
});
