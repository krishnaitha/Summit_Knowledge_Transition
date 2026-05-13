import type { UserProfile } from '@/lib/types/database';
import { formatDate } from '@/lib/utils';

export function generateUsersCsv(
  users: Array<UserProfile & { projectCount?: number }>,
): string {
  const headers = ['Name', 'Email', 'Role', 'Status', 'Created', 'Last Login', 'Projects'];
  
  const rows = users.map((user) => [
    user.full_name ?? user.email,
    user.email,
    user.role,
    user.is_active ? 'Active' : 'Locked',
    formatDate(user.created_at),
    user.last_login_at ? formatDate(user.last_login_at) : 'Never',
    String(user.projectCount ?? 0),
  ]);

  // Create CSV content
  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
