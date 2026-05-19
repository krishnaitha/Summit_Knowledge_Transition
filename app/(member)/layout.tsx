import { MemberMobileSidebar } from '@/components/layout/member-mobile-sidebar';
import { MemberSidebar } from '@/components/layout/member-sidebar';
import { Navbar } from '@/components/layout/navbar';
import { requireMember } from '@/lib/auth';
import { getMemberNotificationCount, getOpenThreadNotificationCount } from '@/lib/data';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireMember();
  const [notificationCount, openThreadCount] = profile
    ? await Promise.all([
        getMemberNotificationCount(profile.id),
        getOpenThreadNotificationCount(profile.id, profile.role),
      ])
    : [0, 0];

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar profile={profile} />
      <MemberMobileSidebar
        notificationCount={notificationCount}
        openThreadCount={openThreadCount}
      />
      <div className="mx-auto flex w-full max-w-[1760px] gap-6 px-5 py-8 sm:px-7 lg:px-10">
        <MemberSidebar notificationCount={notificationCount} openThreadCount={openThreadCount} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
