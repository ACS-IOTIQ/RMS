'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarPinned, setSidebarPinned] = useState(false);

  useEffect(() => {
    setSidebarPinned(window.localStorage.getItem('sidebar-pinned') === 'true');
  }, []);

  const updateSidebar = (pinned: boolean) => {
    setSidebarPinned(pinned);
    window.localStorage.setItem('sidebar-pinned', String(pinned));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'EMPLOYEE') router.replace('/unauthorized');
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'EMPLOYEE') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar role="EMPLOYEE" pinned={sidebarPinned} onPinnedChange={updateSidebar} />
      <div className={cn('transition-[padding] duration-300', sidebarPinned ? 'md:pl-64' : 'md:pl-20')}>{children}</div>
    </div>
  );
}
