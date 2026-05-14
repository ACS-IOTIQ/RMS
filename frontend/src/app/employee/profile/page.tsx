'use client';

import { ReactNode, useState } from 'react';
import {
  Award,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Hash,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatDate, initialsOf } from '@/lib/utils';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const { toast } = useToast();
  const emp = user?.employee;
  const status = emp?.status;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/auth/change-password', passwords);
      toast('Password changed', 'success');
      setPasswords({ currentPassword: '', newPassword: '' });
      refresh();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <Topbar title="My Profile" subtitle="Personal, reporting, and organization mapping" />
      <main className="max-w-6xl space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                {initialsOf(emp?.name ?? user?.email ?? 'User')}
              </div>
              <div>
                <CardTitle className="text-xl">{emp?.name ?? user?.email ?? '-'}</CardTitle>
                <CardDescription className="mt-1">
                  {emp ? `${emp.designation?.name ?? 'No designation'} at ${emp.project?.name ?? 'No project'}` : 'No employee record is linked to this account'}
                </CardDescription>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{emp?.employeeCode ?? 'No employee code'}</Badge>
                  {status ? <Badge variant={status === 'ACTIVE' ? 'success' : 'outline'}>{formatEnum(status)}</Badge> : null}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Identity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                <Row icon={Hash} label="Employee Code" value={emp?.employeeCode} />
                <Row icon={User} label="Employee Name" value={emp?.name} />
                <Row icon={Mail} label="Employee Email" value={emp?.email} />
                <Row icon={Mail} label="Login Email" value={user?.email} />
                <Row icon={Phone} label="Phone" value={emp?.phone} />
                <Row icon={ShieldCheck} label="Role" value={formatEnum(user?.role)} />
                <Row icon={ShieldCheck} label="Status" value={formatEnum(emp?.status)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Organization Mapping
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                <Row icon={Briefcase} label="Project" value={emp?.project?.name} />
                <Row icon={Hash} label="Project Code" value={emp?.project?.code} />
                <Row icon={Building2} label="Client" value={emp?.project?.clientName} />
                <Row icon={MapPin} label="Location" value={emp?.location?.name} />
                <Row icon={Clock} label="Location Timezone" value={emp?.location?.timezone ?? emp?.project?.timezone} />
                <Row icon={Users} label="Location Capacity" value={emp?.location?.capacity} />
                <Row icon={Users} label="Department" value={emp?.department?.name} />
                <Row icon={Users} label="Department Capacity" value={emp?.department ? emp.department.capacity : undefined} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4" />
                Work Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                <Row icon={Award} label="Designation" value={emp?.designation?.name} />
                <Row icon={ShieldCheck} label="Critical Designation" value={emp?.designation ? (emp.designation.isCritical ? 'Yes' : 'No') : undefined} />
                <Row icon={CalendarDays} label="Join Date" value={formatProfileDate(emp?.joinDate)} />
                <Row icon={Clock} label="Max Weekly Hours" value={typeof emp?.maxWeeklyHours === 'number' ? `${emp.maxWeeklyHours} hours` : undefined} />
                <Row icon={Clock} label="Preferred Shifts" value={formatPreferredShifts(emp?.preferredShifts)} />
                <Row icon={User} label="Reporting Manager" value={formatManager(emp?.reportingManager)} />
                <Row icon={Mail} label="Manager Email" value={emp?.reportingManager?.email} />
                <Row icon={Users} label="Direct Reports" value={emp?._count?.directReports ?? 0} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                />
              </div>
              <Button type="submit">Update</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value === null || value === undefined || value === '' ? '-' : value}</dd>
    </div>
  );
}

function formatEnum(value?: string | null) {
  if (!value) return '-';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProfileDate(value?: string | null) {
  if (!value) return '-';
  return formatDate(value, 'long');
}

function formatManager(manager?: { name: string; employeeCode: string } | null) {
  if (!manager) return '-';
  return `${manager.name} (${manager.employeeCode})`;
}

function formatPreferredShifts(shifts?: string[]) {
  if (!shifts?.length) return '-';
  const names: Record<string, string> = {
    A: 'Morning',
    B: 'Afternoon',
    C: 'Night',
    G: 'General',
    F: 'Flexible',
  };
  return shifts.map((shift) => names[shift] ?? shift).join(', ');
}
