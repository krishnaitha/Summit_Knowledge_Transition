import { AdminMobileSidebar } from '@/components/layout/admin-mobile-sidebar';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { Navbar } from '@/components/layout/navbar';
import { requireAnyAdmin } from '@/lib/auth';
import { getOpenThreadNotificationCount } from '@/lib/data';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAnyAdmin();
  const isSuperAdmin = profile?.role === 'admin';
  const openThreadCount = profile
    ? await getOpenThreadNotificationCount(profile.id, profile.role)
    : 0;

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar profile={profile} />
      <AdminMobileSidebar isSuperAdmin={isSuperAdmin} openThreadCount={openThreadCount} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AdminSidebar isSuperAdmin={isSuperAdmin} openThreadCount={openThreadCount} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
