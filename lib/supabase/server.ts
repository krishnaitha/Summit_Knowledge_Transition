import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { appEnv, isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/env';

export function createServerSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const cookieStore = cookies();

  return createServerClient(appEnv.supabaseUrl!, appEnv.supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server components cannot always mutate cookies.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Server components cannot always mutate cookies.
        }
      },
    },
  });
}

export function createServiceRoleSupabaseClient() {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  return createServerClient(appEnv.supabaseUrl!, appEnv.supabaseServiceRoleKey!, {
    cookies: {
      get() {
        return undefined;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
    global: {
      fetch: (url: RequestInfo | URL, init?: RequestInit) =>
        fetch(url, { ...init, cache: 'no-store' }),
    },
  });
}