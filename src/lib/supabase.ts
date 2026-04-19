import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

export function getSupabaseConfigIssue(): string | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return 'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.';
  }

  if (SUPABASE_URL.includes('your-project-ref') || SUPABASE_ANON_KEY.includes('your_public_key')) {
    return 'Supabase is still using placeholder values. Replace .env values with real project credentials.';
  }

  let parsed: URL;
  try {
    parsed = new URL(SUPABASE_URL);
  } catch {
    return 'Invalid Supabase URL format. Check EXPO_PUBLIC_SUPABASE_URL.';
  }

  if (parsed.protocol !== 'https:') {
    return 'Supabase URL must use https.';
  }

  if (!parsed.hostname.endsWith('.supabase.co')) {
    return 'Supabase URL host must end with .supabase.co.';
  }

  if (parsed.hostname.split('.')[0].length < 15) {
    return 'Supabase project ref looks invalid. Use the exact project URL from Supabase settings.';
  }

  return null;
}

const supabaseConfigIssue = getSupabaseConfigIssue();

export const supabase =
  supabaseConfigIssue === null
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export async function checkSupabaseReachable(timeoutMs = 8000): Promise<string | null> {
  const configIssue = supabaseConfigIssue ?? getSupabaseConfigIssue();
  if (configIssue) return configIssue;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return `Supabase endpoint responded with ${response.status}. Verify URL and publishable key.`;
    }

    return null;
  } catch {
    return 'Cannot reach Supabase endpoint from this device. Verify internet access and your project URL.';
  } finally {
    clearTimeout(timeout);
  }
}
