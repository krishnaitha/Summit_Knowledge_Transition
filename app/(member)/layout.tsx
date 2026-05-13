import { MemberMobileSidebar } from '@/components/layout/member-mobile-sidebar';
import { MemberSidebar } from '@/components/layout/member-sidebar';
import { Navbar } from '@/components/layout/navbar';
import { requireMember } from '@/lib/auth';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireMember();

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar profile={profile} />
      <MemberMobileSidebar />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <MemberSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
