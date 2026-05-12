'use client';
import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import {
  AlertTriangle, CalendarDays, CheckCircle2, Download, Eye, Layers3, Loader2,
  RefreshCw, RotateCcw, ShieldAlert, Sparkles, Users,
} from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, apiBlob } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const shiftTone: Record<string, string> = {
  A: 'bg-sky-100 text-sky-800 border-sky-200',
  B: 'bg-violet-100 text-violet-800 border-violet-200',
  C: 'bg-slate-200 text-slate-800 border-slate-300',
  G: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};
const statusTone: Record<string, string> = {
  SCHEDULED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GENERAL: 'bg-teal-50 text-teal-700 border-teal-200',
  WEEKLY_OFF: 'bg-slate-100 text-slate-700 border-slate-200',
  ON_LEAVE: 'bg-rose-50 text-rose-700 border-rose-200',
};
const viewModes = ['Weekly Matrix', 'By Shift', 'Daily Coverage', 'Designation Coverage', 'Leave Impact', 'Replacement Suggestions', 'Fairness'];

function dayKey(value: any) {
  if (!value) return '';
  return format(typeof value === 'string' ? parseISO(value) : value, 'yyyy-MM-dd');
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RosterPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState('Weekly Matrix');
  const [shiftFilter, setShiftFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rosterWeek, setRosterWeek] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const { toast } = useToast();

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, idx) => format(addDays(parseISO(weekStart), idx), 'yyyy-MM-dd')), [weekStart]);
  const entries = rosterWeek?.dailyEntries ?? rosterWeek?.rosterEntries ?? [];
  const assignments = rosterWeek?.weeklyAssignments ?? [];
  const targetSummary = rosterWeek?.targetSummary ?? rosterWeek?.validationSummary?.targetSummary ?? [];
  const issues = rosterWeek?.validationSummary?.issues ?? [];
  const hasCritical = (rosterWeek?.validationSummary?.criticalCount ?? 0) > 0;

  useEffect(() => {
    Promise.all([api.get('/projects'), api.get('/designations')]).then(([projectData, designationData]) => {
      setProjects(projectData);
      setDesignations(Array.isArray(designationData) ? designationData : designationData.data ?? []);
      if (projectData[0]) setProjectId(projectData[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api.get(`/locations?projectId=${projectId}`),
      api.get(`/departments?projectId=${projectId}`),
    ]).then(([locationData, departmentData]) => {
      const nextLocations = Array.isArray(locationData) ? locationData : locationData.data ?? [];
      setLocations(nextLocations);
      setDepartments(Array.isArray(departmentData) ? departmentData : departmentData.data ?? []);
      setLocationId((current) => nextLocations.some((location: any) => location.id === current) ? current : nextLocations[0]?.id ?? '');
    });
  }, [projectId]);

  useEffect(() => {
    if (!locationId) return;
    Promise.all([
      api.get(`/roster-policies?projectId=${projectId}&locationId=${locationId}`),
      api.get(`/roster/weekly?locationId=${locationId}&weekStart=${weekStart}`),
    ]).then(([policyData, roster]) => {
      setPolicy(policyData?.[0] ?? null);
      setRosterWeek(roster);
    }).catch(() => setRosterWeek(null));
  }, [projectId, locationId, weekStart]);

  const filteredEntries = useMemo(() => entries.filter((entry: any) => {
    if (shiftFilter && entry.shiftId !== shiftFilter) return false;
    if (designationFilter && entry.employee?.designationId !== designationFilter) return false;
    if (departmentFilter && entry.employee?.departmentId !== departmentFilter) return false;
    if (statusFilter && entry.status !== statusFilter) return false;
    return true;
  }), [entries, shiftFilter, designationFilter, departmentFilter, statusFilter]);

  const filteredAssignments = useMemo(() => assignments.filter((assignment: any) => {
    if (shiftFilter && assignment.shiftId !== shiftFilter) return false;
    if (designationFilter && assignment.employee?.designationId !== designationFilter) return false;
    if (departmentFilter && assignment.employee?.departmentId !== departmentFilter) return false;
    return true;
  }), [assignments, shiftFilter, designationFilter, departmentFilter]);

  const entryByEmployeeDay = useMemo(() => {
    const map: Record<string, any> = {};
    for (const entry of filteredEntries) map[`${entry.employeeId}:${dayKey(entry.date)}`] = entry;
    return map;
  }, [filteredEntries]);

  const previewRoster = async () => {
    if (!projectId || !locationId) return toast('Select project and location', 'error');
    setLoading(true);
    try {
      const data = await api.post('/roster/weekly/preview', { projectId, locationId, weekStartDate: weekStart, mode: 'overwrite' });
      setRosterWeek(data);
      const critical = data.validationSummary?.criticalCount ?? 0;
      toast(`Preview ready: ${critical} critical, ${data.validationSummary?.warningCount ?? 0} warning(s)`, critical ? 'error' : 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const publishRoster = async () => {
    if (!rosterWeek?.id) return;
    setPublishing(true);
    try {
      const data = await api.post(`/roster/weekly/${rosterWeek.id}/publish`);
      setRosterWeek(data);
      toast('Roster published', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const regenerateRoster = async () => {
    if (!rosterWeek?.id) return previewRoster();
    setLoading(true);
    try {
      const data = await api.post(`/roster/weekly/${rosterWeek.id}/regenerate`);
      setRosterWeek(data);
      toast('Roster regenerated', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportRoster = async () => {
    if (!rosterWeek?.id) return toast('Preview a roster before export', 'error');
    const blob = await apiBlob(`/roster/weekly/${rosterWeek.id}/export.xlsx`);
    saveBlob(blob, `roster-${selectedLocation?.name ?? 'location'}-${weekStart}.xlsx`);
  };

  const requestOverride = async () => {
    if (!rosterWeek?.id || !overrideReason.trim()) return toast('Reason is required', 'error');
    try {
      await api.post(`/roster/weekly/${rosterWeek.id}/override`, {
        severity: 'CRITICAL',
        reason: overrideReason.trim(),
        entityType: 'RosterWeek',
        entityId: rosterWeek.id,
      });
      setOverrideOpen(false);
      setOverrideReason('');
      toast('Override requested', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const summaryCards = [
    ['Eligible', rosterWeek?.eligibleEmployeeCount ?? policy?._count?.employees ?? selectedLocation?._count?.employees ?? '--'],
    ['Daily Headcount', rosterWeek?.requiredDailyHeadcount ?? policy?.requiredDailyHeadcount ?? '--'],
    ['Required Slots', rosterWeek?.requiredWeeklySlots ?? '--'],
    ['Available Slots', rosterWeek?.availableWeeklySlots ?? '--'],
    ['Extra/Shortage', rosterWeek?.extraOrShortageSlots ?? '--'],
    ['Fairness', rosterWeek?.fairnessSummary?.score ?? '--'],
  ];

  return (
    <>
      <Topbar title="Weekly Roster" subtitle="Project, location, and policy based weekly roster planning" />
      <main className="p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-end">
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
                <Label>View</Label>
                <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                  {viewModes.map((mode) => <option key={mode}>{mode}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="SCHEDULED">Working</option>
                  <option value="GENERAL">General</option>
                  <option value="WEEKLY_OFF">Weekly off</option>
                  <option value="ON_LEAVE">On leave</option>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={previewRoster} disabled={loading}>
                  {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                  Preview
                </Button>
                <Button variant="outline" size="icon" onClick={regenerateRoster}><RotateCcw className="h-4 w-4" /></Button>
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
                {locations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => setLocationId(location.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${locationId === location.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{location.name}</span>
                      <Badge variant="outline">{location._count?.employees ?? 0}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{location.timezone ?? 'Local timezone'}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Policy Snapshot</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Daily headcount</span><span>{policy?.requiredDailyHeadcount ?? '--'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Working days</span><span>{policy?.workingDaysPerEmployee ?? '--'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Weekly offs</span><span>{policy?.weeklyOffsPerEmployee ?? '--'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rounding</span><span className="truncate max-w-[140px]">{policy?.roundingPolicy ?? '--'}</span></div>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div className="grid gap-3 md:grid-cols-4 flex-1">
                    <div className="space-y-1.5">
                      <Label>Shift</Label>
                      <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                        <option value="">All shifts</option>
                        {targetSummary.map((target: any) => <option key={target.shiftId} value={target.shiftId}>{target.shiftCode} - {target.shiftName}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Designation</Label>
                      <Select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
                        <option value="">All designations</option>
                        {designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Department</Label>
                      <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                        <option value="">All departments</option>
                        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Week end</Label>
                      <Input value={weekEnd} disabled />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={exportRoster}><Download className="mr-1.5 h-4 w-4" />Export XLSX</Button>
                    <Button variant="outline" onClick={() => setOverrideOpen(true)} disabled={!rosterWeek?.id}><ShieldAlert className="mr-1.5 h-4 w-4" />Override</Button>
                    <Button onClick={publishRoster} disabled={!rosterWeek?.id || publishing || hasCritical}>
                      {publishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                      Publish
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {rosterWeek && (
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {summaryCards.map(([label, value]) => (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-1 text-2xl font-semibold">{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {issues.length > 0 && (
              <Card className={hasCritical ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Validation</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {issues.slice(0, 5).map((issue: any, idx: number) => (
                    <div key={`${issue.code}-${idx}`} className="rounded-md border bg-background p-3 text-sm">
                      <Badge variant={issue.severity === 'CRITICAL' ? 'destructive' : issue.severity === 'WARNING' ? 'warning' : 'outline'}>{issue.severity}</Badge>
                      <span className="ml-2 font-medium">{issue.message}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {renderView()}
          </section>
        </div>
      </main>

      <Dialog open={!!selectedAssignment} onOpenChange={(open) => !open && setSelectedAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assignment Explanation</DialogTitle>
            <DialogDescription>{selectedAssignment?.employee?.name} / {selectedAssignment?.shift?.name}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">{selectedAssignment?.assignmentExplanation ?? selectedAssignment?.explanation ?? 'No explanation recorded.'}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Override</DialogTitle>
            <DialogDescription>Overrides require a reason and are stored in the roster audit trail.</DialogDescription>
          </DialogHeader>
          <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason for override" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button onClick={requestOverride}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  function renderView() {
    if (!rosterWeek) {
      return (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Select a project location and preview the roster for the selected week.
          </CardContent>
        </Card>
      );
    }
    if (viewMode === 'By Shift') return <ByShiftView assignments={filteredAssignments} />;
    if (viewMode === 'Daily Coverage') return <DailyCoverageView entries={filteredEntries} days={days} targets={targetSummary} />;
    if (viewMode === 'Designation Coverage') return <DesignationCoverageView entries={filteredEntries} days={days} targets={targetSummary} />;
    if (viewMode === 'Leave Impact') return <LeaveImpactView entries={filteredEntries} />;
    if (viewMode === 'Replacement Suggestions') return <ReplacementView replacements={rosterWeek.replacementAssignments ?? []} />;
    if (viewMode === 'Fairness') return <FairnessView assignments={filteredAssignments} />;
    return <WeeklyMatrix assignments={filteredAssignments} days={days} entryByEmployeeDay={entryByEmployeeDay} onExplain={setSelectedAssignment} />;
  }
}

function WeeklyMatrix({ assignments, days, entryByEmployeeDay, onExplain }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />Weekly Matrix</CardTitle>
        <CardDescription>Employee rows with fixed weekly shift and day-level status.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 min-w-[230px] border-b bg-card p-2 text-left">Employee</th>
              {days.map((day: string) => <th key={day} className="min-w-[82px] border-b p-2 text-center">{format(parseISO(day), 'EEE dd')}</th>)}
              <th className="border-b p-2 text-center">Why</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment: any) => (
              <tr key={assignment.id} className="hover:bg-muted/40">
                <td className="sticky left-0 border-b bg-card p-2">
                  <div className="font-medium">{assignment.employee?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{assignment.employee?.employeeCode} / {assignment.employee?.designation?.name}</div>
                </td>
                {days.map((day: string) => {
                  const entry = entryByEmployeeDay[`${assignment.employeeId}:${day}`];
                  const status = entry?.status ?? 'SCHEDULED';
                  const label = status === 'SCHEDULED' ? assignment.shift?.code : status === 'WEEKLY_OFF' ? 'OFF' : status === 'ON_LEAVE' ? 'LEAVE' : 'GEN';
                  return (
                    <td key={day} className="border-b p-1 text-center">
                      <span className={`inline-flex min-w-12 justify-center rounded border px-2 py-1 font-semibold ${statusTone[status] ?? shiftTone[assignment.shift?.code] ?? 'bg-muted'}`}>{label}</span>
                    </td>
                  );
                })}
                <td className="border-b p-1 text-center"><Button size="icon" variant="ghost" onClick={() => onExplain(assignment)}><Eye className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ByShiftView({ assignments }: any) {
  const groups = assignments.reduce((acc: Record<string, any[]>, assignment: any) => {
    const key = assignment.shift?.code ?? 'Other';
    acc[key] ??= [];
    acc[key].push(assignment);
    return acc;
  }, {});
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {Object.entries(groups).map(([code, rows]) => (
        <Card key={code}>
          <CardHeader><CardTitle className="text-base">{code} Shift</CardTitle><CardDescription>{(rows as any[]).length} employees</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(rows as any[]).map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-2 text-sm">
                <div className="font-medium">{assignment.employee?.name}</div>
                <div className="text-xs text-muted-foreground">{assignment.employee?.designation?.name} / score {assignment.score}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DailyCoverageView({ entries, days, targets }: any) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4" />Daily Coverage</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead>{targets.map((t: any) => <TableHead key={t.shiftId}>{t.shiftCode}</TableHead>)}<TableHead>Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {days.map((day: string) => {
              let total = 0;
              return (
                <TableRow key={day}>
                  <TableCell>{format(parseISO(day), 'EEE, dd MMM')}</TableCell>
                  {targets.map((target: any) => {
                    const count = entries.filter((entry: any) => dayKey(entry.date) === day && entry.shiftId === target.shiftId && entry.status === 'SCHEDULED').length;
                    total += count;
                    return <TableCell key={target.shiftId}>{count} / {target.dailyTarget ?? target.target}</TableCell>;
                  })}
                  <TableCell className="font-semibold">{total}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DesignationCoverageView({ entries, days, targets }: any) {
  const designations = Array.from(new Set(entries.map((entry: any) => entry.employee?.designation?.name).filter(Boolean)));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Designation Coverage</CardTitle></CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Shift</TableHead>{designations.map((name: any) => <TableHead key={name}>{name}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {days.flatMap((day: string) => targets.map((target: any) => (
              <TableRow key={`${day}-${target.shiftId}`}>
                <TableCell>{format(parseISO(day), 'EEE dd')}</TableCell>
                <TableCell>{target.shiftCode}</TableCell>
                {designations.map((designation: any) => (
                  <TableCell key={designation}>{entries.filter((entry: any) => dayKey(entry.date) === day && entry.shiftId === target.shiftId && entry.status === 'SCHEDULED' && entry.employee?.designation?.name === designation).length}</TableCell>
                ))}
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LeaveImpactView({ entries }: any) {
  const rows = entries.filter((entry: any) => ['ON_LEAVE', 'WEEKLY_OFF', 'GENERAL'].includes(entry.status));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Leave, Weekly Off, and Buffer Impact</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Shift</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((entry: any, idx: number) => (
              <TableRow key={`${entry.employeeId}-${entry.date}-${idx}`}>
                <TableCell>{format(parseISO(dayKey(entry.date)), 'dd MMM')}</TableCell>
                <TableCell>{entry.employee?.name}</TableCell>
                <TableCell>{entry.shift?.code}</TableCell>
                <TableCell><Badge variant="outline">{entry.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReplacementView({ replacements }: any) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Replacement Suggestions</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Shift</TableHead><TableHead>Replacement</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {replacements.map((replacement: any) => (
              <TableRow key={replacement.id}>
                <TableCell>{format(parseISO(dayKey(replacement.date)), 'dd MMM')}</TableCell>
                <TableCell>{replacement.shift?.code}</TableCell>
                <TableCell>{replacement.replacementEmployee?.name ?? 'Unresolved'}</TableCell>
                <TableCell>{replacement.score}</TableCell>
                <TableCell><Badge variant={replacement.status === 'UNRESOLVED' ? 'destructive' : 'outline'}>{replacement.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FairnessView({ assignments }: any) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Fairness</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Shift</TableHead><TableHead>Group</TableHead><TableHead>Score</TableHead><TableHead>Explanation</TableHead></TableRow></TableHeader>
          <TableBody>
            {assignments.map((assignment: any) => (
              <TableRow key={assignment.id}>
                <TableCell>{assignment.employee?.name}</TableCell>
                <TableCell>{assignment.shift?.name}</TableCell>
                <TableCell>{assignment.weeklyGroup}</TableCell>
                <TableCell>{assignment.score}</TableCell>
                <TableCell className="max-w-[420px] truncate">{assignment.assignmentExplanation ?? assignment.explanation}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
