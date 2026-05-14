'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('sidebar-collapsed');
    if (stored) setSidebarCollapsed(stored === 'true');
  }, []);

  const updateSidebar = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    window.localStorage.setItem('sidebar-collapsed', String(collapsed));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'ADMIN') router.replace('/employee');
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar role="ADMIN" collapsed={sidebarCollapsed} onCollapsedChange={updateSidebar} />
      <div className={cn('transition-all duration-200', sidebarCollapsed ? 'md:pl-20' : 'md:pl-64')}>{children}</div>
    </div>
  );
}
