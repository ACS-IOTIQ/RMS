'use client';
import { useEffect, useState } from 'react';
import { format, parseISO, startOfWeek } from 'date-fns';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, apiBlob } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const colors = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#be185d'];
const views = ['Shift Coverage Trend', 'Designation Coverage', 'Weekly Off Distribution', 'Leave Impact', 'Replacement Workload', 'Fairness Score', 'Night Shift Burden', 'Validation Issues'];

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [view, setView] = useState('Shift Coverage Trend');
  const [data, setData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get('/projects').then((rows) => {
      setProjects(rows);
      if (rows[0]) setProjectId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/locations?projectId=${projectId}`).then((rows) => {
      const next = Array.isArray(rows) ? rows : rows.data ?? [];
      setLocations(next);
      setLocationId((current) => next.some((location: any) => location.id === current) ? current : next[0]?.id ?? '');
    });
  }, [projectId]);

  useEffect(() => { loadAnalytics(); }, [projectId, locationId, weekStart]);

  async function loadAnalytics() {
    if (!projectId) return;
    try {
      const qs = new URLSearchParams({ projectId, weekStart });
      if (locationId) qs.set('locationId', locationId);
      setData(await api.get(`/analytics/roster?${qs.toString()}`));
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  async function exportAnalytics() {
    const qs = new URLSearchParams({ projectId, weekStart });
    if (locationId) qs.set('locationId', locationId);
    const blob = await apiBlob(`/analytics/roster/export.xlsx?${qs.toString()}`);
    saveBlob(blob, `roster-analytics-${weekStart}.xlsx`);
  }

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedLocation = locations.find((location) => location.id === locationId);

  return (
    <>
      <Topbar title="Roster Analytics" subtitle="Project, location, and week based roster insights" />
      <main className="p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] items-end">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Week</Label>
                <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Analytics view</Label>
                <Select value={view} onChange={(e) => setView(e.target.value)}>
                  {views.map((item) => <option key={item}>{item}</option>)}
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={loadAnalytics}><RefreshCw className="h-4 w-4" /></Button>
                <Button onClick={exportAnalytics}><Download className="mr-1.5 h-4 w-4" />Export XLSX</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Locations</CardTitle>
                <CardDescription>{selectedProject?.name ?? 'Selected project'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  onClick={() => setLocationId('')}
                  className={`w-full rounded-md border p-3 text-left text-sm ${!locationId ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
                >
                  All project locations
                </button>
                {locations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => setLocationId(location.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${locationId === location.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{location.name}</span>
                      <Badge variant="outline">{location._count?.employees ?? 0}</Badge>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              {(data?.summary ?? []).slice(0, 4).map((row: any) => (
                <Card key={row.rosterWeekId ?? row.location}>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">{row.location}</div>
                    <div className="mt-1 text-xl font-semibold">{row.requiredDailyHeadcount ?? '--'} daily</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.extraOrShortageSlots ?? '--'} extra/shortage slots</div>
                  </CardContent>
                </Card>
              ))}
              {!data?.summary?.length && (
                <Card className="md:col-span-4"><CardContent className="py-8 text-center text-muted-foreground">No roster data for the selected week.</CardContent></Card>
              )}
            </div>
            {renderView()}
          </section>
        </div>
      </main>
    </>
  );

  function renderView() {
    if (!data) return null;
    if (view === 'Designation Coverage') return <RowsTable title="Designation Coverage" rows={data.designationCoverage} columns={['date', 'shift', 'designation', 'actual']} />;
    if (view === 'Weekly Off Distribution') return (
      <ChartCard title="Weekly Off Distribution" description={selectedLocation?.name ?? selectedProject?.name}>
        <BarChart data={data.weeklyOffDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#64748b" radius={[6, 6, 0, 0]} /></BarChart>
      </ChartCard>
    );
    if (view === 'Leave Impact') return <RowsTable title="Leave Impact" rows={data.leaveImpact} columns={['date', 'employee', 'designation', 'shift', 'location']} />;
    if (view === 'Replacement Workload') return <RowsTable title="Replacement Workload" rows={data.replacementWorkload} columns={['date', 'status', 'source', 'overtimeFlag']} />;
    if (view === 'Fairness Score') return (
      <ChartCard title="Fairness Score" description="Higher is better">
        <BarChart data={data.fairnessScore}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="location" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="score" fill="#059669" radius={[6, 6, 0, 0]} /></BarChart>
      </ChartCard>
    );
    if (view === 'Night Shift Burden') return (
      <ChartCard title="Night Shift Burden" description="Employee-level night workload">
        <BarChart data={data.nightShiftBurden} layout="vertical" margin={{ left: 100 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="employee" type="category" tick={{ fontSize: 11 }} width={140} /><Tooltip /><Bar dataKey="count" fill="#d97706" radius={[0, 6, 6, 0]} /></BarChart>
      </ChartCard>
    );
    if (view === 'Validation Issues') return <RowsTable title="Validation Issues" rows={data.validationIssues} columns={['location', 'severity', 'code', 'message', 'recommendation']} />;
    return (
      <ChartCard title="Shift Coverage Trend" description={`${format(parseISO(data.weekStart), 'dd MMM')} to ${format(parseISO(data.weekEnd), 'dd MMM')}`}>
        <LineChart data={data.shiftCoverageTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line dataKey="A" stroke={colors[0]} strokeWidth={2} /><Line dataKey="B" stroke={colors[1]} strokeWidth={2} /><Line dataKey="C" stroke={colors[2]} strokeWidth={2} /><Line dataKey="total" stroke={colors[3]} strokeWidth={2} /></LineChart>
      </ChartCard>
    );
  }
}

function ChartCard({ title, description, children }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" />{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RowsTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {!rows?.length && <TableRow><TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">No data</TableCell></TableRow>}
            {(rows ?? []).map((row, index) => (
              <TableRow key={index}>{columns.map((column) => <TableCell key={column}>{String(row[column] ?? '')}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
