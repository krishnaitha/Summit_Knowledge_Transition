'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';

import { createClientSupabaseClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    if (isPending) return;
    setIsPending(true);
    const supabase = createClientSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      title="Log out"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <LogOut className="h-4 w-4" />}
    </button>
  );
}
