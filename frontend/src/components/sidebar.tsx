'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Building2, MapPin, Briefcase, Award, Clock,
  CalendarDays, FileSearch, FileText, LogOut, PanelLeftClose, PanelLeftOpen,
  ShieldCheck, User, CalendarCheck, Network, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/organizations', label: 'Organization', icon: Building2 },
  { href: '/admin/projects', label: 'Project', icon: Briefcase },
  { href: '/admin/locations', label: 'Locations', icon: MapPin },
  { href: '/admin/departments', label: 'Departments', icon: Network },
  { href: '/admin/designations', label: 'Designations', icon: Award },
  { href: '/admin/shifts', label: 'Shifts', icon: Clock },
  { href: '/admin/employees', label: 'Employees', icon: Users },
  { href: '/admin/roster-policy', label: 'Roster Policy', icon: SlidersHorizontal },
  { href: '/admin/roster', label: 'Roster', icon: CalendarDays },
  { href: '/admin/leaves', label: 'Leaves', icon: FileText },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileSearch },
];

const empNav = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/roster', label: 'My Roster', icon: CalendarDays },
  { href: '/employee/leaves', label: 'My Leaves', icon: CalendarCheck },
  { href: '/employee/profile', label: 'Profile', icon: User },
];

function isRouteActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/admin' || href === '/employee') return false;
  return pathname.startsWith(`${href}/`);
}

export function Sidebar({
  role,
  collapsed,
  onCollapsedChange,
}: {
  role: 'ADMIN' | 'EMPLOYEE';
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const nav = role === 'ADMIN' ? adminNav : empNav;

  return (
    <aside className={cn(
      'fixed inset-y-0 hidden border-r bg-card transition-all duration-200 md:flex md:flex-col',
      collapsed ? 'md:w-20' : 'md:w-64',
    )}>
      <div className={cn('flex h-14 items-center border-b px-3', collapsed ? 'justify-center' : 'gap-2')}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className={cn('flex flex-col leading-tight', collapsed && 'hidden')}>
          <span className="text-sm font-semibold">RosterOps</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Workforce Suite</span>
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="border-b p-3">
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="flex h-10 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className={cn('flex-1 overflow-y-auto p-3 space-y-1', collapsed && 'px-2')}>
        {nav.map((item) => {
          const active = isRouteActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className={cn('flex items-center rounded-md p-2 mb-1', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
            <div className="text-xs font-medium truncate">{user?.employee?.name ?? user?.email}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className={cn(
            'w-full flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
            collapsed ? 'justify-center' : 'gap-2',
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
