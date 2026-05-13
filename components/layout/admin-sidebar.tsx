'use client';

import { FolderKanban, LayoutDashboard, Users } from 'lucide-react';

import { Sidebar } from './sidebar';

export function AdminSidebar({ isSuperAdmin = true }: { isSuperAdmin?: boolean }) {
  const items = [
    ...(isSuperAdmin ? [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
    ...(isSuperAdmin ? [{ href: '/admin/users', label: 'Users', icon: Users }] : []),
  ];

  return <Sidebar items={items} sectionLabel={isSuperAdmin ? 'Admin' : 'Project Admin'} />;
}
