import { AdminMobileSidebar } from '@/components/layout/admin-mobile-sidebar';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { Navbar } from '@/components/layout/navbar';
import { requireAnyAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAnyAdmin();
  const isSuperAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar profile={profile} />
      <AdminMobileSidebar isSuperAdmin={isSuperAdmin} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AdminSidebar isSuperAdmin={isSuperAdmin} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}