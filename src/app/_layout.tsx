import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="student-id" />
        <Stack.Screen name="pending" />
        <Stack.Screen name="rejected" />
        <Stack.Screen name="approval-complete" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat-room" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="create-team" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="invite-link" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="match-success" options={{ animation: 'fade' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
