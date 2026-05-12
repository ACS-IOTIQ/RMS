'use client';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { User, Mail, Briefcase, MapPin, Award } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const emp = user?.employee;

  return (
    <>
      <Topbar title="My Profile" subtitle="Personal and organizational details" />
      <main className="p-4 md:p-6 max-w-3xl">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold">
              {emp?.name?.[0] ?? user?.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-lg">{emp?.name ?? '—'}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{emp?.employeeCode ?? '—'}</Badge>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Row icon={Mail} label="Email" value={user?.email} />
              <Row icon={User} label="Role" value={user?.role} />
              <Row icon={Award} label="Designation" value={emp?.designation?.name} />
              <Row icon={Briefcase} label="Project" value={emp?.project?.name} />
              <Row icon={MapPin} label="Location" value={emp?.location?.name} />
            </dl>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Row({ icon: Icon, label, value }: any) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}</dt>
      <dd className="mt-1 font-medium">{value ?? '—'}</dd>
    </div>
  );
}
