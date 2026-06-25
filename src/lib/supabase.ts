import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://pmompybsbnkrjhdhikcr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fl0G1wcW4ylI8X8m1YVvqw_loEKwM1F';

// 웹 SSR(Node.js) 환경에서는 AsyncStorage가 window를 참조해 크래시.
// 네이티브에서만 AsyncStorage를 스토리지로 사용.
const authStorage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
