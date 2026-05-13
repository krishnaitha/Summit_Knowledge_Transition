'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Loader2, LogOut } from 'lucide-react';

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    if (isPending) return;
    setIsPending(true);
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      title="Log out"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
    </button>
  );
}
