import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function SplashScreen() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/onboarding'), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>indeed</Text>
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>같은 학교, 다른 학과</Text>
        <Text style={styles.subtitle}>과팅의 새로운 방법</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 72,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: -2,
    marginBottom: 16,
  },
  subtitleContainer: {
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
  },
});
