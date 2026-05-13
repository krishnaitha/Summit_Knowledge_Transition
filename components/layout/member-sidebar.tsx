'use client';

import { FolderOpen, LayoutDashboard } from 'lucide-react';

import { Sidebar } from './sidebar';

export function MemberSidebar({ notificationCount = 0 }: { notificationCount?: number }) {
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: notificationCount },
    { href: '/projects', label: 'My Projects', icon: FolderOpen },
  ];

  return <Sidebar items={items} sectionLabel="Member" />;
}
