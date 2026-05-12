'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Clock, FileText, TrendingUp } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { format, isToday, isTomorrow, parseISO, addDays } from 'date-fns';

const codeColor: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700',
  B: 'bg-violet-100 text-violet-700',
  C: 'bg-slate-200 text-slate-800',
  G: 'bg-emerald-100 text-emerald-700',
  F: 'bg-amber-100 text-amber-700',
};

function labelFor(entry: any) {
  if (entry.status === 'ON_LEAVE') return `Leave - ${entry.shift.name}`;
  if (entry.status === 'WEEKLY_OFF') return `Off - ${entry.shift.name}`;
  return `${entry.shift.code} - ${entry.shift.name}${entry.isReplacement ? ' cover' : ''}`;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [roster, setRoster] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    const from = format(new Date(), 'yyyy-MM-dd');
    const to = format(addDays(new Date(), 30), 'yyyy-MM-dd');
    api.get(`/roster/my?from=${from}&to=${to}`).then(setRoster);
    api.get('/leaves/my').then(setLeaves);
  }, []);

  const today = roster.find((r) => isToday(parseISO(r.date)));
  const tomorrow = roster.find((r) => isTomorrow(parseISO(r.date)));
  const upcoming = roster.slice(0, 7);
  const nightShifts = roster.filter((r) => r.shift.code === 'C' && r.status === 'SCHEDULED' && !r.isReplacement).length;
  const approvedLeaves = leaves.filter((l) => l.status === 'APPROVED').length;

  return (
    <>
      <Topbar title={`Welcome, ${user?.employee?.name?.split(' ')[0] ?? 'there'}`} subtitle="Your schedule and quick info" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Today</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {today ? (
                <>
                  <div className={`inline-block px-2 py-0.5 rounded text-sm font-semibold ${codeColor[today.shift.code]}`}>{labelFor(today)}</div>
                  <p className="text-xs text-muted-foreground mt-2">{today.shift.startTime} - {today.shift.endTime}</p>
                </>
              ) : <div className="text-sm text-muted-foreground">No shift assigned</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Tomorrow</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {tomorrow ? (
                <>
                  <div className={`inline-block px-2 py-0.5 rounded text-sm font-semibold ${codeColor[tomorrow.shift.code]}`}>{labelFor(tomorrow)}</div>
                  <p className="text-xs text-muted-foreground mt-2">{tomorrow.shift.startTime} - {tomorrow.shift.endTime}</p>
                </>
              ) : <div className="text-sm text-muted-foreground">No shift assigned</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Night Shifts (next 30d)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{nightShifts}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Approved Leaves</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{approvedLeaves}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming shifts</CardTitle>
            <CardDescription>Your next seven scheduled days, leave days, weekly offs, and replacement duties</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 && <div className="text-sm text-muted-foreground">No upcoming shifts.</div>}
            <div className="space-y-2">
              {upcoming.map((r) => (
                <div key={r.id} className="flex items-center gap-4 border-b last:border-0 py-2">
                  <div className="text-center min-w-[60px]">
                    <div className="text-xs text-muted-foreground">{format(parseISO(r.date), 'EEE')}</div>
                    <div className="text-lg font-semibold">{format(parseISO(r.date), 'dd')}</div>
                    <div className="text-xs text-muted-foreground">{format(parseISO(r.date), 'MMM')}</div>
                  </div>
                  <div className="flex-1">
                    <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${codeColor[r.shift.code]}`}>{labelFor(r)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.shift.startTime} - {r.shift.endTime} / {r.shift.location?.name}</div>
                  </div>
                  <Badge variant={r.status === 'CANCELLED' || r.status === 'ON_LEAVE' ? 'destructive' : r.status === 'WEEKLY_OFF' ? 'secondary' : 'outline'}>
                    {r.isReplacement ? 'REPLACEMENT' : r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
