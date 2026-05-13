import Link from "next/link";

import { LogoutButton } from "@/components/layout/logout-button";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { appEnv } from "@/lib/env";
import type { UserProfile } from "@/lib/types/database";

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email?.[0] ?? "U").toUpperCase();
}

export function Navbar({ profile }: { profile: UserProfile | null }) {
  const initials = getInitials(
    profile?.full_name ?? null,
    profile?.email ?? null,
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700 shadow-sm">
            <span className="text-xs font-bold text-white">S</span>
          </div>
          <div>
            <Link
              href={
                profile?.role === "admin" ? "/admin/dashboard" : "/dashboard"
              }
              className="text-sm font-semibold text-slate-900 transition hover:text-brand-700"
            >
              {appEnv.appName}
            </Link>
            <p className="hidden text-xs leading-tight text-slate-400 sm:block">
              Knowledge transfer workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">
              {profile?.full_name ?? profile?.email ?? "Guest"}
            </p>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
              {profile?.role ?? "setup"}
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials}
          </div>
          {profile && <LogoutButton />}
        </div>
      </div>
    </header>
  );
}
