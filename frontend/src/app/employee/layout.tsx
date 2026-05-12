'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/lib/auth-context';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'EMPLOYEE') router.replace('/admin');
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'EMPLOYEE') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar role="EMPLOYEE" />
      <div className="md:pl-64">{children}</div>
    </div>
  );
}
