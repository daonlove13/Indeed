import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function MatchSuccessPage() {
  const { department, myDepartment } = useLocalSearchParams<{
    department: string;
    myDepartment: string;
  }>();
  const insets = useSafeAreaInsets();
  const scaleAnim = new Animated.Value(0.5);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.emoji}>🎉</Text>
        </Animated.View>
        <Text style={styles.title}>매칭 성공!</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.bold}>{myDepartment}</Text> 팀과{'\n'}
          <Text style={styles.bold}>{department}</Text> 팀이 연결됐어요!
        </Text>
        <Text style={styles.desc}>
          채팅에서 인사를 나눠보세요.{'\n'}
          장소와 시간을 정하고 즐거운 과팅을 시작해요!
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            router.replace('/(tabs)/chat');
          }}
        >
          <Feather name="message-circle" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>채팅하러 가기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryBtnText}>나중에 하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconWrap: {
    width: 100, height: 100, backgroundColor: '#000', borderRadius: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 32, fontWeight: '700', color: '#0a0a0a', marginBottom: 12 },
  subtitle: { fontSize: 18, color: '#0a0a0a', textAlign: 'center', lineHeight: 26, marginBottom: 16 },
  bold: { fontWeight: '700' },
  desc: { fontSize: 14, color: '#6a7282', textAlign: 'center', lineHeight: 22 },
  footer: { paddingHorizontal: 24, gap: 12 },
  primaryBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, color: '#9ca3af' },
});
