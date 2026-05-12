'use client';
import { useEffect, useState } from 'react';
import { Users, MapPin, Briefcase, Clock, FileText, CalendarDays, Award, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Topbar } from '@/components/topbar';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [status, setStatus] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [o, s, d, sh] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/status'),
        api.get('/analytics/designations'),
        api.get('/analytics/shifts'),
      ]);
      setOverview(o);
      setStatus(s);
      setDesignations(d);
      setShifts(sh);
    })();
  }, []);

  const stats = [
    { label: 'Total Employees', value: overview?.employees ?? '—', icon: Users, trend: 'all-time' },
    { label: 'Active Workforce', value: overview?.activeEmployees ?? '—', icon: TrendingUp, trend: 'currently active' },
    { label: 'Locations', value: overview?.locations ?? '—', icon: MapPin, trend: 'operational sites' },
    { label: 'Projects', value: overview?.projects ?? '—', icon: Briefcase, trend: 'managed projects' },
    { label: 'Shifts Defined', value: overview?.shifts ?? '—', icon: Clock, trend: 'across locations' },
    { label: 'Designations', value: overview?.designations ?? '—', icon: Award, trend: 'workforce tiers' },
    { label: 'Today’s Roster', value: overview?.todayEntries ?? '—', icon: CalendarDays, trend: 'assigned today' },
    { label: 'Pending Leaves', value: overview?.pendingLeaves ?? '—', icon: FileText, trend: 'awaiting approval' },
  ];

  return (
    <>
      <Topbar title="Operations Overview" subtitle="Workforce, scheduling and compliance at a glance" />
      <main className="p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{s.value}</div>
                <p className="text-xs text-muted-foreground capitalize">{s.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workforce by Designation</CardTitle>
              <CardDescription>Distribution across role tiers</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {designations.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={designations}>
                    <XAxis dataKey="designation" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employees by Status</CardTitle>
              <CardDescription>Active, on leave, probation and more</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {status.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={status} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {status.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shift Allocation (Last 30 Days)</CardTitle>
            <CardDescription>Volume of roster assignments per shift</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {shifts.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shifts}>
                  <XAxis dataKey="shift" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
