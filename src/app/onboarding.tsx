import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const SLIDES = [
  {
    emoji: '🎓',
    title: '같은 학교,\n다른 학과',
    desc: '충북대학교 학생들끼리\n학과를 넘어 새로운 인연을 만들어요.',
  },
  {
    emoji: '👥',
    title: '팀으로 함께,\n2:2 또는 3:3',
    desc: '혼자가 아닌 팀으로 참여해요.\n부담 없이 즐거운 과팅이 시작돼요.',
  },
  {
    emoji: '✅',
    title: '학생증으로\n안전하게',
    desc: '학생증 인증을 통해\n재학생만 참여할 수 있어요.',
  },
];

export default function OnboardingScreen() {
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];
  const insets = useSafeAreaInsets();

  const next = () => {
    if (isLast) router.replace('/login');
    else setSlide(s => s + 1);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.skipBtn, { paddingTop: insets.top + 16 }]} onPress={() => router.replace('/login')}>
        <Text style={styles.skipText}>건너뛰기</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.emoji}>{current.emoji}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.desc}>{current.desc}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 32) }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === slide ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={next}>
          <Text style={styles.buttonText}>
            {isLast ? '시작하기' : '다음'}
          </Text>
          {!isLast && <Feather name="chevron-right" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  skipText: {
    fontSize: 13,
    color: '#99a1af',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0a0a0a',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  desc: {
    fontSize: 15,
    color: '#6a7282',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#000',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#e5e7eb',
  },
  button: {
    alignSelf: 'stretch',
    height: 56,
    backgroundColor: '#000',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
