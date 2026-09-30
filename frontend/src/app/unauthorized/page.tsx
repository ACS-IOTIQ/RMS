'use client';

import Link from 'next/link';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  ROSTER_MANAGER: 'Roster Manager',
  PROJECT_MANAGER: 'Project Manager',
  COMPLIANCE_ADMIN: 'Compliance Admin',
  EMPLOYEE: 'Employee',
};

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const homeHref = user?.role === 'ADMIN' ? '/admin' : user ? '/employee' : '/login';

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page.
          {user && (
            <>
              {' '}You're signed in as <span className="font-medium text-foreground">{user.email}</span>{' '}
              ({ROLE_LABEL[user.role] ?? user.role}).
            </>
          )}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={homeHref}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {user ? 'Go to my dashboard' : 'Go to login'}
            </Link>
          </Button>
          {user && (
            <Button variant="outline" className="w-full" onClick={logout}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
