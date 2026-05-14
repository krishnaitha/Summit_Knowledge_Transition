"use client";

import { Menu } from "lucide-react";
import { MOBILE_NAV_OPEN_EVENT } from "./mobile-sidebar";

export function MobileMenuButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(MOBILE_NAV_OPEN_EVENT))}
      aria-label="Open navigation"
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 xl:hidden"
    >
      <Menu className="h-4 w-4 text-slate-600" />
    </button>
  );
}
