'use client';

import { BellRing, FolderKanban, LayoutDashboard, Search, Users, Wand2 } from 'lucide-react';

import { MobileSidebar } from './mobile-sidebar';

export function AdminMobileSidebar({
  isSuperAdmin = true,
  openThreadCount = 0,
}: {
  isSuperAdmin?: boolean;
  openThreadCount?: number;
}) {
  const items = [
    ...(isSuperAdmin
      ? [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
      : []),
    { href: '/admin/projects', label: 'Products', icon: FolderKanban },
    { href: '/admin/generate-document', label: 'AI Document Generator', icon: Wand2 },
    { href: '/admin/search', label: 'Search Docs', icon: Search },
    { href: '/admin/threads', label: 'Threads', icon: BellRing, badge: openThreadCount },
    ...(isSuperAdmin ? [{ href: '/admin/users', label: 'Users', icon: Users }] : []),
  ];

  return <MobileSidebar items={items} sectionLabel={isSuperAdmin ? 'Admin' : 'Product Admin'} />;
}
