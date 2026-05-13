'use client';

import { FolderKanban, LayoutDashboard, Users } from 'lucide-react';

import { MobileSidebar } from './mobile-sidebar';

const items = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export function AdminMobileSidebar() {
  return <MobileSidebar items={items} sectionLabel="Admin" />;
}
