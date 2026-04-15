import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kslmzthdojxsbbqblrgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TiQZY_FdpqugWokFmlG3yw_UfQL4uFJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
