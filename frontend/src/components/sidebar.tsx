'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Building2, MapPin, Briefcase, Award, Clock,
  CalendarDays, FileText, BarChart3, LogOut, ShieldCheck, User, CalendarCheck, Network, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/employees', label: 'Employees', icon: Users },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/projects', label: 'Projects', icon: Briefcase },
  { href: '/admin/locations', label: 'Locations', icon: MapPin },
  { href: '/admin/departments', label: 'Departments', icon: Network },
  { href: '/admin/designations', label: 'Designations', icon: Award },
  { href: '/admin/shifts', label: 'Shifts', icon: Clock },
  { href: '/admin/roster-policy', label: 'Roster Policy', icon: SlidersHorizontal },
  { href: '/admin/roster', label: 'Roster', icon: CalendarDays },
  { href: '/admin/leaves', label: 'Leaves', icon: FileText },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

const empNav = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/roster', label: 'My Roster', icon: CalendarDays },
  { href: '/employee/leaves', label: 'My Leaves', icon: CalendarCheck },
  { href: '/employee/profile', label: 'Profile', icon: User },
];

export function Sidebar({ role }: { role: 'ADMIN' | 'EMPLOYEE' }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const nav = role === 'ADMIN' ? adminNav : empNav;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col fixed inset-y-0 border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">RosterOps</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Workforce Suite</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/employee' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md p-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{user?.employee?.name ?? user?.email}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
