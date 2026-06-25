import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadStudentCard, getStats } from '../services/api';

interface Props {
  defaultState?: 'idle' | 'pending';
}

export default function StudentIdPage({ defaultState = 'idle' }: Props) {
  const [state, setState] = useState<'idle' | 'uploading' | 'uploaded' | 'pending' | 'error'>(defaultState);
  const [errorMsg, setErrorMsg] = useState('');
  const [maleWaiting, setMaleWaiting] = useState(0);
  const [femaleWaiting, setFemaleWaiting] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getStats().then(s => {
      setMaleWaiting(s.maleWaiting);
      setFemaleWaiting(s.femaleWaiting);
    });
  }, []);

  const handleUpload = async (uri: string, mimeType: string) => {
    setState('uploading');
    setErrorMsg('');
    try {
      await uploadStudentCard(uri, mimeType);
      setState('uploaded');
      setTimeout(() => setState('pending'), 800);
    } catch (e) {
      setErrorMsg(String(e));
      setState('error');
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      setErrorMsg('파일 크기는 10MB 이하여야 해요.');
      setState('error');
      return;
    }
    await handleUpload(asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await handleUpload(asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  const isPendingState = state === 'pending';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        {!isPendingState && state !== 'uploading' && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={20} color="#6a7282" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerLogo}>
          <Text style={styles.logoText}>indeed</Text>
        </View>
      </View>

      {!isPendingState ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepLabel}>마지막 단계</Text>
          <Text style={styles.title}>학생증을{'\n'}인증해주세요</Text>
          <Text style={styles.subtitle}>
            재학 중인 학교 학생증 사진을 올려주세요.{'\n'}
            확인 후 <Text style={styles.bold}>30분 이내</Text> 승인돼요.
          </Text>

          <TouchableOpacity
            style={[
              styles.uploadArea,
              state === 'uploaded' && styles.uploadAreaSuccess,
              state === 'uploading' && styles.uploadAreaUploading,
              state === 'error' && styles.uploadAreaError,
            ]}
            onPress={state !== 'uploading' ? handlePickImage : undefined}
            activeOpacity={0.9}
          >

            {state === 'uploading' && (
              <>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.uploadLabel}>업로드 중...</Text>
              </>
            )}
            {state === 'uploaded' && (
              <>
                <Feather name="check-circle" size={48} color="#000" />
                <Text style={styles.uploadLabel}>업로드 완료!</Text>
              </>
            )}
            {state === 'error' && (
              <>
                <Feather name="alert-circle" size={48} color="#f87171" />
                <Text style={[styles.uploadLabel, { color: '#ef4444' }]}>업로드 실패</Text>
                <Text style={styles.uploadSub}>{errorMsg}</Text>
                <Text style={styles.uploadSub}>다시 시도하려면 탭하세요</Text>
              </>
            )}
            {state === 'idle' && (
              <>
                <View style={styles.cameraIcon}>
                  <Feather name="camera" size={32} color="#fff" />
                </View>
                <Text style={styles.uploadLabel}>사진 찍기 또는 불러오기</Text>
                <Text style={styles.uploadSub}>학생증이 잘 보이게 촬영해주세요</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsText}>
              · 이름, 학번, 학교명이 모두 보여야 해요{'\n'}
              · 모자이크나 가림 없이 선명하게 찍어주세요{'\n'}
              · 제출 정보는 인증 목적으로만 사용돼요
            </Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaBtnHalf, state === 'uploading' && styles.ctaBtnDisabled]}
              onPress={state !== 'uploading' ? handleTakePhoto : undefined}
              disabled={state === 'uploading'}
            >
              <Feather name="camera" size={16} color="#fff" />
              <Text style={styles.ctaBtnText}>카메라로 찍기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaBtnHalf, state === 'uploading' && styles.ctaBtnDisabled]}
              onPress={state !== 'uploading' ? handlePickImage : undefined}
              disabled={state === 'uploading'}
            >
              {state === 'uploading' ? (
                <ActivityIndicator size="small" color="#99a1af" />
              ) : (
                <Feather name="image" size={16} color="#fff" />
              )}
              <Text style={state === 'uploading' ? styles.ctaBtnTextDisabled : styles.ctaBtnText}>
                {state === 'uploading' ? '업로드 중...' : '갤러리에서 선택'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.pendingHeader}>
            <View style={styles.pendingIcon}>
              <Text style={styles.pendingIconText}>?</Text>
            </View>
            <View style={styles.pendingBadge}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingBadgeText}>심사 중</Text>
            </View>
            <Text style={styles.pendingTitle}>심사 중이에요</Text>
            <Text style={styles.pendingSubtitle}>
              보통 <Text style={styles.bold}>30분 이내</Text>로 승인 알림이 와요.{'\n'}
              앱을 종료해도 알림으로 알려드려요.
            </Text>
          </View>

          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>실시간 대기 현황</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{maleWaiting}</Text>
                <Text style={styles.statDesc}>남성 팀 대기 중</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{femaleWaiting}</Text>
                <Text style={styles.statDesc}>여성 팀 대기 중</Text>
              </View>
            </View>
            <Text style={styles.statsFooter}>승인 완료 후 바로 매칭에 참여할 수 있어요!</Text>
          </View>

          <Text style={styles.pendingFooter}>
            승인 완료 시 알림으로 알려드려요.{'\n'}
            앱을 닫고 기다려도 괜찮아요 😊
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 13,
    color: '#6a7282',
  },
  headerLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 16,
  },
  stepLabel: {
    fontSize: 12,
    color: '#99a1af',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0a0a0a',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#6a7282',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#000',
  },
  uploadArea: {
    height: 220,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5dc',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  uploadAreaSuccess: {
    borderColor: '#000',
  },
  uploadAreaUploading: {
    borderColor: '#99a1af',
  },
  uploadAreaError: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  cameraIcon: {
    width: 72,
    height: 72,
    backgroundColor: '#000',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  uploadSub: {
    fontSize: 13,
    color: '#99a1af',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  tipsBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
  },
  tipsText: {
    fontSize: 12,
    color: '#6a7282',
    lineHeight: 20,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  ctaBtn: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnHalf: { flex: 1 },
  ctaBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  ctaBtnTextDisabled: {
    fontSize: 15,
    fontWeight: '600',
    color: '#99a1af',
  },
  pendingHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  pendingIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#000',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pendingIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pendingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#000',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6a7282',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pendingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
    marginBottom: 8,
  },
  pendingSubtitle: {
    fontSize: 14,
    color: '#6a7282',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  statsLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 36,
    marginBottom: 4,
  },
  statDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  statsFooter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  pendingFooter: {
    fontSize: 13,
    color: '#99a1af',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
