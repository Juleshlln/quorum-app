import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/dashboard/nav';
import { DashboardHeader } from '@/components/dashboard/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-transparent flex relative overflow-hidden">
      {/* Ambient layers */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="quorum-ambient-grid absolute inset-0 opacity-[0.08]" />
        <div
          className="absolute top-[-18%] right-[-6%] h-[32rem] w-[32rem] rounded-full blur-[170px]"
          style={{ background: 'var(--quorum-orb-top)' }}
        />
        <div
          className="absolute bottom-[-22%] left-[-10%] h-[28rem] w-[28rem] rounded-full blur-[140px]"
          style={{ background: 'var(--quorum-orb-bottom)' }}
        />
      </div>

      {/* Sidebar */}
      <DashboardNav />

      {/* Main content */}
      <div className="quorum-dashboard-main relative flex min-h-screen flex-1 flex-col">
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
