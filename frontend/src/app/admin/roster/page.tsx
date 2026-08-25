'use client';
import { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Download, Eye, Layers3, Loader2,
  MapPin, RotateCcw, ShieldAlert, Sparkles, Users,
} from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, apiBlob } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { sortRows } from '@/lib/table-tools';

const shiftTone: Record<string, string> = {
  A: 'bg-sky-100 text-sky-800 border-sky-300',
  B: 'bg-amber-100 text-amber-900 border-amber-300',
  C: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  G: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};
const statusTone: Record<string, string> = {
  GENERAL: 'bg-teal-50 text-teal-700 border-teal-200',
  WEEKLY_OFF: 'bg-slate-100 text-slate-700 border-slate-200',
  ON_LEAVE: 'bg-rose-50 text-rose-700 border-rose-200',
};
const viewModes = ['Weekly Matrix', 'By Shift', 'Daily Coverage', 'Designation Coverage', 'Leave Impact', 'Replacement Suggestions', 'Fairness'];
const periodOptions = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'three-month', label: '3 Months' },
];

function dayKey(value: any) {
  if (!value) return '';
  return format(typeof value === 'string' ? parseISO(value) : value, 'yyyy-MM-dd');
}

function shiftLabel(shift: any) {
  const code = String(shift?.code ?? '').toUpperCase();
  if (code === 'A') return 'Morning';
  if (code === 'B') return 'Afternoon';
  if (code === 'C') return 'Night';
  if (code === 'G') return 'General';
  return shift?.name ?? code;
}

function targetLabel(target: any) {
  return shiftLabel({ code: target?.shiftCode, name: target?.shiftName });
}

function rosterCellTone(status: string, shiftCode?: string) {
  if (status === 'SCHEDULED') return shiftTone[shiftCode ?? ''] ?? 'bg-muted text-foreground border-border';
  return statusTone[status] ?? 'bg-muted text-foreground border-border';
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
  const [projectId, setProjectId] = useState('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [periodMode, setPeriodMode] = useState<'week' | 'month' | 'three-month'>('week');
  const [exportScope, setExportScope] = useState<'location' | 'all'>('location');
  const [viewMode, setViewMode] = useState('Weekly Matrix');
  const [rosterWeek, setRosterWeek] = useState<any>(null);
  const [periodReport, setPeriodReport] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  // Only Admins can see/download roster data across every location; every other
  // role is restricted server-side to their own assigned location (see the
  // backend's getAllowedLocationIds), so "All locations" isn't a real choice for them.
  const isAdminUser = user?.role === 'ADMIN';

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedLocations = locations.filter((location) => locationIds.includes(location.id));
  const selectedLocation = selectedLocations[0];
  const primaryLocationId = locationIds[0] ?? '';
  const locationsLabel = selectedLocations.length === 0
    ? 'Select location'
    : selectedLocations.length === 1
      ? selectedLocations[0].name
      : `${selectedLocations[0].name} +${selectedLocations.length - 1}`;
  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'), [weekStart]);
  const periodStart = useMemo(() => {
    const anchor = parseISO(weekStart);
    if (periodMode === 'month') return format(startOfMonth(anchor), 'yyyy-MM-dd');
    if (periodMode === 'three-month') return format(startOfMonth(anchor), 'yyyy-MM-dd');
    return weekStart;
  }, [periodMode, weekStart]);
  const periodEnd = useMemo(() => {
    const anchor = parseISO(weekStart);
    if (periodMode === 'month') return format(endOfMonth(anchor), 'yyyy-MM-dd');
    if (periodMode === 'three-month') return format(addDays(addMonths(startOfMonth(anchor), 3), -1), 'yyyy-MM-dd');
    return weekEnd;
  }, [periodMode, weekEnd, weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, idx) => format(addDays(parseISO(weekStart), idx), 'yyyy-MM-dd')), [weekStart]);
  const periodDays = useMemo(() => {
    const start = parseISO(periodStart);
    const end = parseISO(periodEnd);
    const count = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return Array.from({ length: count }, (_, idx) => format(addDays(start, idx), 'yyyy-MM-dd'));
  }, [periodStart, periodEnd]);
  const visiblePeriodDays = useMemo(() => {
    if (periodMode === 'week' || !periodReport?.calendarRows?.length) return periodDays;
    const activeDays = periodDays.filter((day) => periodReport.calendarRows.some((row: any) => row.days?.[day]?.label));
    if (!activeDays.length) return periodDays;
    return periodDays.slice(periodDays.indexOf(activeDays[0]), periodDays.indexOf(activeDays[activeDays.length - 1]) + 1);
  }, [periodDays, periodMode, periodReport]);
  const entries = rosterWeek?.dailyEntries ?? rosterWeek?.rosterEntries ?? [];
  const assignments = rosterWeek?.weeklyAssignments ?? [];
  const targetSummary = rosterWeek?.targetSummary ?? rosterWeek?.validationSummary?.targetSummary ?? [];
  const issues = periodMode === 'week' ? rosterWeek?.validationSummary?.issues ?? [] : periodReport?.validationIssues ?? [];
  const hasCritical = periodMode === 'week'
    ? (rosterWeek?.validationSummary?.criticalCount ?? 0) > 0
    : (periodReport?.summary?.criticalIssues ?? 0) > 0;
  const hasRosterData = periodMode === 'week' ? Boolean(rosterWeek) : Boolean(periodReport);

  useEffect(() => {
    api.get('/projects').then((projectData) => {
      setProjects(projectData);
      if (projectData[0]) setProjectId(projectData[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/locations?projectId=${projectId}`).then((locationData) => {
      const nextLocations = Array.isArray(locationData) ? locationData : locationData.data ?? [];
      setLocations(nextLocations);
      setLocationIds((current) => {
        const kept = current.filter((id) => nextLocations.some((location: any) => location.id === id));
        if (kept.length) return kept;
        return nextLocations[0] ? [nextLocations[0].id] : [];
      });
    });
  }, [projectId]);

  useEffect(() => {
    if (!isAdminUser && exportScope === 'all') setExportScope('location');
  }, [isAdminUser, exportScope]);

  const toggleLocationId = (id: string) => {
    setLocationIds((prev) => prev.includes(id) ? prev.filter((locId) => locId !== id) : [...prev, id]);
  };
  const toggleAllLocationIds = () => {
    setLocationIds((prev) => prev.length === locations.length ? [] : locations.map((location) => location.id));
  };

  useEffect(() => {
    if (!projectId || !primaryLocationId) return;
    const policyRequest = api.get(`/roster-policies?projectId=${projectId}&locationId=${primaryLocationId}`);
    if (periodMode === 'week') {
      Promise.all([
        policyRequest,
        api.get(`/roster/weekly?locationId=${primaryLocationId}&weekStart=${weekStart}`),
      ]).then(([policyData, roster]) => {
        setPolicy(policyData?.[0] ?? null);
        setRosterWeek(roster);
        setPeriodReport(null);
      }).catch(() => {
        setRosterWeek(null);
        setPeriodReport(null);
      });
      return;
    }

    if (exportScope === 'location' && !locationIds.length) return;
    const params = new URLSearchParams({
      projectId,
      startDate: periodStart,
      endDate: periodEnd,
      period: periodMode,
      scope: exportScope,
    });
    if (exportScope === 'location') params.set('locationIds', locationIds.join(','));
    Promise.all([
      policyRequest,
      api.get(`/roster/period?${params.toString()}`),
    ]).then(([policyData, report]) => {
      setPolicy(policyData?.[0] ?? null);
      setRosterWeek(null);
      setPeriodReport(report);
    }).catch(() => {
      setRosterWeek(null);
      setPeriodReport(null);
    });
  }, [projectId, locationIds, primaryLocationId, weekStart, periodMode, periodStart, periodEnd, exportScope]);

  const filteredEntries = entries;
  const filteredAssignments = useMemo(() => sortRows(assignments, 'employee.name', 'asc'), [assignments]);

  const entryByEmployeeDay = useMemo(() => {
    const map: Record<string, any> = {};
    for (const entry of filteredEntries) map[`${entry.employeeId}:${dayKey(entry.date)}`] = entry;
    return map;
  }, [filteredEntries]);

  const previewRoster = async () => {
    if (!projectId || (periodMode === 'week' ? !primaryLocationId : exportScope === 'location' && !locationIds.length)) {
      return toast('Select project and at least one location', 'error');
    }
    setLoading(true);
    try {
      if (periodMode !== 'week') {
        const body: any = {
          projectId,
          startDate: periodStart,
          endDate: periodEnd,
          period: periodMode,
          scope: exportScope,
        };
        if (exportScope === 'location') body.locationIds = locationIds;
        const result = await api.post('/roster/period/preview', body);
        setRosterWeek(null);
        setPeriodReport(result.report);
        toast(`Period ready: ${result.refreshedCount ?? 0} week(s) refreshed across ${locationIds.length || 'all'} location(s)`, 'success');
        return;
      }
      const data = await api.post('/roster/weekly/preview', { projectId, locationId: primaryLocationId, weekStartDate: weekStart, mode: 'overwrite' });
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
    if (periodMode !== 'week') return previewRoster();
    if (!rosterWeek?.id) return previewRoster();
    setLoading(true);
    try {
      const data = await api.post(`/roster/weekly/${rosterWeek.id}/regenerate`);
      setRosterWeek(data);
      if (periodMode !== 'week') {
        const params = new URLSearchParams({
          projectId,
          startDate: periodStart,
          endDate: periodEnd,
          period: periodMode,
          scope: exportScope,
        });
        if (exportScope === 'location') params.set('locationIds', locationIds.join(','));
        setPeriodReport(await api.get(`/roster/period?${params.toString()}`));
      }
      toast('Roster regenerated', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportRoster = async () => {
    if (!projectId) return toast('Select project before export', 'error');
    if (exportScope === 'location' && !locationIds.length) return toast('Select at least one location before export', 'error');
    const params = new URLSearchParams({
      projectId,
      startDate: periodStart,
      endDate: periodEnd,
      period: periodMode,
      scope: exportScope,
    });
    if (exportScope === 'location') params.set('locationIds', locationIds.join(','));
    const blob = await apiBlob(`/roster/export.xlsx?${params.toString()}`);
    const scopeLabel = exportScope === 'all' ? 'all-locations' : selectedLocations.map((location) => location.name).join('-') || 'location';
    saveBlob(blob, `roster-${periodMode}-${scopeLabel}-${periodStart}-to-${periodEnd}.xlsx`);
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

  const summaryCards = periodMode === 'week' ? [
    ['Eligible', rosterWeek?.eligibleEmployeeCount ?? policy?._count?.employees ?? selectedLocation?._count?.employees ?? '--'],
    ['Daily Headcount', rosterWeek?.requiredDailyHeadcount ?? policy?.requiredDailyHeadcount ?? '--'],
    ['Required Slots', rosterWeek?.requiredWeeklySlots ?? '--'],
    ['Available Slots', rosterWeek?.availableWeeklySlots ?? '--'],
    ['Extra/Shortage', rosterWeek?.extraOrShortageSlots ?? '--'],
    ['Fairness', rosterWeek?.fairnessSummary?.score ?? '--'],
  ] : [
    ['Weeks', periodReport?.summary?.weeks ?? 0],
    ['Locations', periodReport?.summary?.locations ?? 0],
    ['Employees', periodReport?.summary?.employees ?? 0],
    ['Daily Headcount', periodReport?.summary?.requiredDailyHeadcount ?? policy?.requiredDailyHeadcount ?? '--'],
    ['Required Total', periodReport?.summary?.requiredDailyHeadcountCalculation ?? periodReport?.summary?.requiredDailyHeadcountTotal ?? '--'],
    ['Warnings', periodReport?.summary?.warnings ?? 0],
  ];

  return (
    <>
      <Topbar title="Roster" subtitle={`${locationsLabel} / ${periodStart} to ${periodEnd}`} />
      <main className="space-y-4 p-3 md:p-5">
        <Card className="rounded-lg">
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,320px)]">
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Roster setup</div>
                    <div className="text-xs text-muted-foreground">{periodStart} to {periodEnd}</div>
                  </div>
                  <Badge variant={hasCritical ? 'destructive' : hasRosterData ? 'success' : 'outline'}>
                    {hasCritical ? 'Action required' : hasRosterData ? 'Report ready' : 'No preview'}
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_.75fr_.85fr_.9fr_.9fr]">
                  <div className="space-y-1.5">
                    <Label>Project</Label>
                    <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location{locationIds.length > 1 ? `s (${locationIds.length})` : ''}</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-9 w-full justify-between px-3 font-normal disabled:opacity-60"
                          disabled={exportScope === 'all'}
                          title={exportScope === 'all' ? 'Scope is set to All locations' : undefined}
                        >
                          <span className="truncate">{exportScope === 'all' ? 'All locations' : locationsLabel}</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
                        <DropdownMenuLabel>Select locations</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                          checked={locations.length > 0 && locationIds.length === locations.length}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={toggleAllLocationIds}
                        >
                          Select all
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {locations.map((location) => (
                          <DropdownMenuCheckboxItem
                            key={location.id}
                            checked={locationIds.includes(location.id)}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={() => toggleLocationId(location.id)}
                          >
                            {location.name} ({location._count?.employees ?? 0})
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{periodMode === 'week' ? 'Week start' : 'Period anchor'}</Label>
                    <DatePicker value={weekStart} onChange={setWeekStart} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Period</Label>
                    <Select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as any)}>
                      {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Scope</Label>
                    <Select
                      value={exportScope}
                      onChange={(e) => setExportScope(e.target.value as any)}
                      disabled={!isAdminUser}
                      title={!isAdminUser ? 'Only Admins can view or download all locations' : undefined}
                    >
                      <option value="location">Selected location(s)</option>
                      {isAdminUser && <option value="all">All locations</option>}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>View</Label>
                    <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                      {viewModes.map((mode) => <option key={mode}>{mode}</option>)}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <div className="mb-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</div>
                  <div className="text-sm font-semibold">Generate and publish</div>
                </div>
                <div className="space-y-2">
                  <Button className="h-10 w-full justify-start" onClick={previewRoster} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {periodMode === 'week' ? 'Preview roster' : 'Preview period'}
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Button className="h-10 justify-start" variant="outline" onClick={regenerateRoster}>
                      <RotateCcw className="mr-2 h-4 w-4" />Regenerate
                    </Button>
                    <Button className="h-10 justify-start" variant="outline" onClick={exportRoster}>
                      <Download className="mr-2 h-4 w-4" />Export report
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Button className="h-10 justify-start" variant="outline" onClick={() => setOverrideOpen(true)} disabled={!rosterWeek?.id}>
                      <ShieldAlert className="mr-2 h-4 w-4" />Override
                    </Button>
                    <Button className="h-10 justify-start" onClick={publishRoster} disabled={!rosterWeek?.id || publishing || hasCritical}>
                      {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Publish
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {(periodMode === 'week' ? rosterWeek : periodReport) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-background px-4 py-3">
                <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
                <div className="mt-1 text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {exportScope === 'all' ? 'All locations' : selectedLocations.length ? selectedLocations.map((location) => location.name).join(', ') : 'No location selected'}
          </span>
          <span>{selectedProject?.name ?? ''}</span>
          <span className="ml-auto">Policy: {policy?.requiredDailyHeadcount ?? '--'} daily / {policy?.workingDaysPerEmployee ?? '--'} working days</span>
        </div>

        {renderView()}

        {issues.length > 0 && (
          <Card className={hasCritical ? 'rounded-lg border-red-200 bg-red-50/30' : 'rounded-lg border-amber-200 bg-amber-50/30'}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Validation</CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 space-y-2 overflow-y-auto p-4 pt-0">
              {issues.map((issue: any, idx: number) => (
                <div key={`${issue.code}-${idx}`} className="rounded-md border bg-background p-3 text-sm">
                  <Badge variant={issue.severity === 'CRITICAL' ? 'destructive' : issue.severity === 'WARNING' ? 'warning' : 'outline'}>{issue.severity}</Badge>
                  <span className="ml-2 font-medium">{issue.message}</span>
                  {issue.recommendation && <div className="mt-1 text-xs text-muted-foreground">{issue.recommendation}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
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
    if (periodMode !== 'week') {
      if (!periodReport) {
        return (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No roster data for the selected {periodMode}.
            </CardContent>
          </Card>
        );
      }
      return <PeriodMatrix rows={periodReport.calendarRows ?? []} days={visiblePeriodDays} periodMode={periodMode} />;
    }

    if (!rosterWeek) {
      return (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No roster preview for the selected week.
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
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-center justify-between p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />Weekly Matrix</CardTitle>
        <Badge variant="outline">{assignments.length} employees</Badge>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-300px)] min-h-[420px] overflow-auto p-0">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-20 bg-card">
            <tr>
              <th className="sticky left-0 z-30 min-w-[250px] border-b bg-card p-3 text-left">Employee</th>
              {days.map((day: string) => <th key={day} className="min-w-[96px] border-b p-3 text-center">{format(parseISO(day), 'EEE dd')}</th>)}
              <th className="border-b p-3 text-center">Why</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className="p-10 text-center text-muted-foreground">No assignments found.</td>
              </tr>
            )}
            {assignments.map((assignment: any) => (
              <tr key={assignment.id} className="hover:bg-muted/40">
                <td className="sticky left-0 z-10 border-b bg-card p-3">
                  <div className="font-medium">{assignment.employee?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{assignment.employee?.employeeCode} / {assignment.employee?.designation?.name}</div>
                </td>
                {days.map((day: string) => {
                  const entry = entryByEmployeeDay[`${assignment.employeeId}:${day}`];
                  const status = entry?.status ?? 'SCHEDULED';
                  const label = status === 'SCHEDULED' ? shiftLabel(assignment.shift) : status === 'WEEKLY_OFF' ? 'OFF' : status === 'ON_LEAVE' ? 'LEAVE' : 'GEN';
                  return (
                    <td key={day} className="border-b p-2 text-center">
                      <span className={`inline-flex min-w-24 justify-center rounded-md border px-2 py-1.5 font-semibold ${rosterCellTone(status, assignment.shift?.code)}`}>{label}</span>
                    </td>
                  );
                })}
                <td className="border-b p-2 text-center"><Button size="icon" variant="ghost" onClick={() => onExplain(assignment)}><Eye className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PeriodMatrix({ rows, days, periodMode }: any) {
  const title = periodMode === 'month' ? 'Monthly Matrix' : '3 Month Matrix';
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-center justify-between p-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />{title}</CardTitle>
          <CardDescription>Combined from saved weekly rosters in the selected period.</CardDescription>
        </div>
        <Badge variant="outline">{rows.length} employees</Badge>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-300px)] min-h-[420px] overflow-auto p-0">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-20 bg-card">
            <tr>
              <th className="sticky left-0 z-30 min-w-[280px] border-b bg-card p-3 text-left">Employee</th>
              {days.map((day: string) => (
                <th key={day} className="min-w-[86px] border-b p-3 text-center">
                  {format(parseISO(day), periodMode === 'three-month' ? 'dd MMM' : 'EEE dd')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="p-10 text-center text-muted-foreground">
                  No roster rows found for this period.
                </td>
              </tr>
            )}
            {rows.map((row: any) => (
              <tr key={row.key} className="hover:bg-muted/40">
                <td className="sticky left-0 z-10 border-b bg-card p-3">
                  <div className="font-medium">{row.employee}</div>
                  <div className="text-[10px] text-muted-foreground">{row.location} / {row.employeeCode} / {row.designation}</div>
                </td>
                {days.map((day: string) => {
                  const cell = row.days?.[day];
                  return (
                    <td key={day} className="border-b p-2 text-center">
                      {cell?.label ? (
                        <span className={`inline-flex min-w-16 justify-center rounded-md border px-2 py-1.5 font-semibold ${rosterCellTone(cell.status, cell.shiftCode)}`}>{cell.label}</span>
                      ) : (
                        <span className="inline-flex min-w-16 justify-center rounded-md border border-transparent px-2 py-1.5 text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
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
          <CardHeader><CardTitle className="text-base">{shiftLabel({ code })}</CardTitle><CardDescription>{(rows as any[]).length} employees</CardDescription></CardHeader>
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
          <TableHeader><TableRow><TableHead>Date</TableHead>{targets.map((t: any) => <TableHead key={t.shiftId}>{targetLabel(t)}</TableHead>)}<TableHead>Total</TableHead></TableRow></TableHeader>
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
                <TableCell>{targetLabel(target)}</TableCell>
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
                <TableCell>{shiftLabel(entry.shift)}</TableCell>
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
                <TableCell>{shiftLabel(replacement.shift)}</TableCell>
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
                <TableCell>{shiftLabel(assignment.shift)}</TableCell>
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
