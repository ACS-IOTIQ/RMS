'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Building2, MapPin, Briefcase, Award, Clock,
  CalendarDays, FileSearch, FileText, LogOut, Pin, PinOff,
  User, CalendarCheck, Network, SlidersHorizontal,
} from 'lucide-react';
import { Logo } from '@/components/logo';
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

// Small delays so sweeping the cursor past the rail doesn't flash it open,
// and briefly leaving the edge doesn't snap it shut.
const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 220;

function isRouteActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/admin' || href === '/employee') return false;
  return pathname.startsWith(`${href}/`);
}

/**
 * Icon rail that slides open over the page while hovered (or focused), and
 * closes when the cursor leaves. Pinning keeps it open and pushes the page.
 * Icons sit at a fixed x position so they don't jump while it slides.
 */
export function Sidebar({
  role,
  pinned,
  onPinnedChange,
}: {
  role: 'ADMIN' | 'EMPLOYEE';
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const nav = role === 'ADMIN' ? adminNav : empNav;
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const open = pinned || hovered;

  const schedule = (next: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(next), next ? OPEN_DELAY_MS : CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const label = cn(
    'whitespace-nowrap transition-opacity duration-200',
    open ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0',
  );

  return (
    <aside
      onMouseEnter={() => schedule(true)}
      onMouseLeave={() => schedule(false)}
      onFocus={() => { clearTimeout(timer.current); setHovered(true); }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) schedule(false);
      }}
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r bg-card md:flex md:flex-col',
        'transition-[width,box-shadow] duration-300 ease-[cubic-bezier(.2,.7,.3,1)]',
        open ? 'w-64' : 'w-20',
        open && !pinned && 'shadow-[8px_0_32px_rgba(15,27,45,0.12)]',
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b pl-[23px] pr-3">
        <Logo size={34} alt="" />
        <div className={cn('flex min-w-0 flex-col leading-tight', label)}>
          <span className="text-sm font-semibold">RosterOps</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Workforce Suite</span>
        </div>
        <button
          type="button"
          onClick={() => onPinnedChange(!pinned)}
          tabIndex={open ? 0 : -1}
          className={cn(
            'ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
            label,
          )}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          aria-pressed={pinned}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-4 py-3">
        {nav.map((item) => {
          const active = isRouteActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              aria-label={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t px-4 py-3">
        <div className="mb-1 flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className={cn('min-w-0 flex-1', label)}>
            <div className="truncate text-xs font-medium">{user?.employee?.name ?? user?.email}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={label}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
