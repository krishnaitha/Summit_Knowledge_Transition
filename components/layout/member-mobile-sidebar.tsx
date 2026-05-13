'use client';

import { FolderOpen, LayoutDashboard } from 'lucide-react';

import { MobileSidebar } from './mobile-sidebar';

export function MemberMobileSidebar({ notificationCount = 0 }: { notificationCount?: number }) {
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: notificationCount },
    { href: '/projects', label: 'My Projects', icon: FolderOpen },
  ];

  return <MobileSidebar items={items} sectionLabel="Member" />;
}
