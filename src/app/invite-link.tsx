import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getInviteInfo } from '../services/api';
import { useTeam } from '../hooks/useData';

export default function InviteLinkPage() {
  const { team } = useTeam();
  const [inviteInfo, setInviteInfo] = useState<{ link: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getInviteInfo().then(info => {
      setInviteInfo(info);
      setLoading(false);
    });
  }, []);

  const handleShare = async () => {
    if (!inviteInfo) return;
    try {
      await Share.share({
        message: `[indeed] 과팅 초대 코드: ${inviteInfo.code}\n\nindeed 앱에서 '팀 합류하기'를 누르고 코드를 입력해주세요!`,
      });
    } catch {}
  };

  const handleCopyCode = () => {
    if (!inviteInfo) return;
    Clipboard.setStringAsync(inviteInfo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <Text style={styles.title}>친구를{'\n'}초대하세요</Text>
        <Text style={styles.subtitle}>코드를 공유해서 팀원을 모집해요</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
        ) : inviteInfo ? (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>초대 코드</Text>
              <Text style={styles.code}>{inviteInfo.code}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
                <Feather name={copied ? 'check' : 'copy'} size={16} color={copied ? '#4ade80' : '#000'} />
                <Text style={[styles.copyText, copied && { color: '#4ade80' }]}>
                  {copied ? '복사됨!' : '복사하기'}
                </Text>
              </TouchableOpacity>
            </View>

            {team && (
              <View style={styles.teamInfo}>
                <Text style={styles.teamInfoLabel}>팀 정보</Text>
                <Text style={styles.teamInfoText}>
                  {team.teamName} · {team.gender} · {team.size === '2v2' ? '2:2' : '3:3'} ({team.members.length}/{team.maxMembers}명)
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Feather name="share-2" size={18} color="#fff" />
              <Text style={styles.shareBtnText}>공유하기</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.errorText}>초대 코드를 불러오지 못했어요</Text>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.doneBtnText}>홈으로 가기</Text>
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
  subtitle: { fontSize: 14, color: '#6a7282', marginBottom: 32 },
  codeCard: {
    backgroundColor: '#f9fafb', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
  },
  codeLabel: { fontSize: 12, color: '#6a7282', marginBottom: 8 },
  code: { fontSize: 40, fontWeight: '700', color: '#000', letterSpacing: 8, marginBottom: 16 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  copyText: { fontSize: 14, fontWeight: '500', color: '#000' },
  teamInfo: {
    backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  teamInfoLabel: { fontSize: 11, color: '#6a7282', marginBottom: 4 },
  teamInfoText: { fontSize: 14, fontWeight: '600', color: '#0a0a0a' },
  shareBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  errorText: { fontSize: 14, color: '#6a7282', textAlign: 'center', marginTop: 40 },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  doneBtn: {
    borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
});
