'use client';

import { FolderOpen, LayoutDashboard } from 'lucide-react';

import { MobileSidebar } from './mobile-sidebar';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'My Projects', icon: FolderOpen },
];

export function MemberMobileSidebar() {
  return <MobileSidebar items={items} sectionLabel="Member" />;
}
