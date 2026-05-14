'use client';
import { useEffect, useMemo, useState } from 'react';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const shiftTone: Record<string, string> = {
  A: 'border-blue-300 bg-blue-100 text-blue-800',
  B: 'border-amber-300 bg-amber-100 text-amber-900',
  C: 'border-indigo-300 bg-indigo-100 text-indigo-900',
  G: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  F: 'border-rose-300 bg-rose-100 text-rose-800',
};

const shiftNames: Record<string, string> = {
  A: 'Morning',
  B: 'Afternoon',
  C: 'Night',
  G: 'General',
  F: 'Flexible',
};

const shiftLegend = [
  { code: 'A', label: 'Morning' },
  { code: 'B', label: 'Afternoon' },
  { code: 'C', label: 'Night' },
  { code: 'G', label: 'General' },
  { code: 'F', label: 'Flexible' },
];

function shiftLabel(shift: any) {
  if (!shift) return 'Shift';
  return shiftNames[shift.code] ?? shift.name ?? shift.code ?? 'Shift';
}

function entryLabel(entry: any) {
  if (entry.status === 'ON_LEAVE') return 'Leave';
  if (entry.status === 'WEEKLY_OFF') return 'Off';
  if (entry.isReplacement) return `${shiftLabel(entry.shift)} cover`;
  return shiftLabel(entry.shift);
}

export default function MyRosterPage() {
  const [month, setMonth] = useState(new Date());
  const [entries, setEntries] = useState<any[]>([]);

  const load = async () => {
    const from = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const to = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setEntries(await api.get(`/roster/my?from=${from}&to=${to}`));
  };
  useEffect(() => { load(); }, [month]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const entry of entries) {
      const key = format(parseISO(entry.date), 'yyyy-MM-dd');
      map[key] ??= [];
      map[key].push(entry);
    }
    return map;
  }, [entries]);

  return (
    <>
      <Topbar title="My Roster" subtitle="Monthly shift calendar" />
      <main className="p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{format(month, 'MMMM yyyy')}</CardTitle>
              <CardDescription>Weekly shifts, leave days, weekly offs, and replacement duties</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {days.map((d) => {
                const key = format(d, 'yyyy-MM-dd');
                const dayEntries = byDate[key] ?? [];
                const inMonth = isSameMonth(d, month);
                return (
                  <div
                    key={key}
                    className={`min-h-[88px] border rounded-md p-1.5 ${inMonth ? 'bg-card' : 'bg-muted/30 opacity-50'} ${isToday(d) ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="text-xs text-muted-foreground">{format(d, 'd')}</div>
                    <div className="mt-1 space-y-1">
                      {dayEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`inline-flex max-w-full items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${entry.isReplacement ? 'ring-1 ring-offset-1 ring-current' : ''} ${entry.status === 'ON_LEAVE' ? 'bg-rose-50 text-rose-700 border-rose-200' : entry.status === 'WEEKLY_OFF' ? 'bg-slate-100 text-slate-700 border-slate-200' : shiftTone[entry.shift?.code] ?? 'bg-muted'}`}
                        >
                          {entryLabel(entry)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              {shiftLegend.map(({ code, label }) => (
                <div key={code} className="flex items-center gap-2">
                  <span className={`inline-flex min-w-20 items-center justify-center rounded border px-2 py-1 font-semibold ${shiftTone[code]}`}>{label}</span>
                </div>
              ))}
              <Badge variant="destructive">Leave</Badge>
              <Badge variant="secondary">Off</Badge>
              <Badge variant="outline">Replacement</Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
