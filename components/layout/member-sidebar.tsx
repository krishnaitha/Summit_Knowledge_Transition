'use client';

import { BellRing, Brain, FolderOpen, LayoutDashboard, Search } from 'lucide-react';

import { Sidebar } from './sidebar';

export function MemberSidebar({
  notificationCount = 0,
  openThreadCount = 0,
}: {
  notificationCount?: number;
  openThreadCount?: number;
}) {
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: notificationCount },
    { href: '/projects', label: 'My Products', icon: FolderOpen },
    { href: '/search', label: 'Search Docs', icon: Search },
    { href: '/memory', label: 'Memory', icon: Brain },
    { href: '/threads', label: 'Threads', icon: BellRing, badge: openThreadCount },
  ];

  return <Sidebar items={items} sectionLabel="Member" />;
}
