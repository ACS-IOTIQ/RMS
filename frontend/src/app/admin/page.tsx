'use client';

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Briefcase,
  Check,
  Download,
  Filter,
  Globe2,
  Layers3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BentoCard, CARD_CLASS, DataTable, KpiCard, ToastStack, TooltipProvider, inter, useDashboardToasts } from './_dashboard/bento';
import {
  type DrillDatum,
  type GroupDatum,
  type LocationDatum,
  DonutChart,
  DrillDown,
  GroupBarChart,
  GroupSummaryBlocks,
  LocationStackChart,
} from './_dashboard/charts';
import { CustomizeDrawer, type WidgetMeta } from './_dashboard/customize-drawer';
import { type DistributionRow, DistributionTable } from './_dashboard/distribution-table';
import {
  type DesignationGroup,
  EASE,
  GROUPS,
  labelize,
  percent,
  reducedMotion,
  resolveDesignationGroup,
  useFlipGrid,
} from './_dashboard/shared';

type ViewScope = 'all' | 'location';
type Filters = {
  projectId: string;
  viewScope: ViewScope;
  locationId: string;
  group: string;
  designationId: string;
  status: string;
  workforce: string;
  search: string;
};
const EMPTY_FILTERS: Filters = {
  projectId: '',
  viewScope: 'all',
  locationId: '',
  group: '',
  designationId: '',
  status: '',
  workforce: '',
  search: '',
};

const STATUS_ORDER = ['ACTIVE', 'ON_LEAVE', 'PROBATION', 'TRAINING', 'BENCH', 'SUSPENDED', 'RESIGNED'];
const WORKFORCE_ORDER = ['PRIMARY', 'BACKUP', 'CONTRACTOR', 'INTERN', 'TEMPORARY'];

const KPI_SPAN = 'col-span-6 md:col-span-4 xl:col-span-2';
const WIDGETS: (WidgetMeta & { span: string })[] = [
  { id: 'stat-total', label: 'Filtered Employees', category: 'Stat', span: KPI_SPAN },
  { id: 'stat-active', label: 'Active Workforce', category: 'Stat', span: KPI_SPAN },
  { id: 'stat-locations', label: 'Locations', category: 'Stat', span: KPI_SPAN },
  { id: 'stat-groups', label: 'Groups', category: 'Stat', span: KPI_SPAN },
  { id: 'stat-designations', label: 'Designations', category: 'Stat', span: KPI_SPAN },
  { id: 'stat-primary', label: 'Primary Category', category: 'Stat', span: KPI_SPAN },
  { id: 'chart-group-pie', label: 'Group-Wise Distribution', category: 'Chart', span: 'col-span-12 md:col-span-6 xl:col-span-4' },
  { id: 'chart-group-bar', label: 'Group-Wise Employee Count', category: 'Chart', span: 'col-span-12 md:col-span-6 xl:col-span-4' },
  { id: 'chart-location-compare', label: 'Multi-Location Comparison', category: 'Chart', span: 'col-span-12 xl:col-span-4' },
  { id: 'chart-designation-drilldown', label: 'Designation Drill-Down', category: 'Chart', span: 'col-span-12 xl:col-span-5' },
  { id: 'table-group-summary', label: 'Group Summary', category: 'Table', span: 'col-span-12 xl:col-span-7' },
  { id: 'table-distribution', label: 'Workforce Distribution Table', category: 'Table', span: 'col-span-12' },
];
const DEFAULT_ORDER = WIDGETS.map((widget) => widget.id);
const LAYOUT_KEY = 'roster_admin_dashboard_layout_v2';
const LEGACY_LAYOUT_KEY = 'roster_admin_dashboard_layout_v1';
type Layout = { order: string[]; hidden: string[] };

function loadLayout(): Layout {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Layout;
      const known = saved.order.filter((id) => DEFAULT_ORDER.includes(id));
      // Cards added in a later release show up at the end.
      return {
        order: [...known, ...DEFAULT_ORDER.filter((id) => !known.includes(id))],
        hidden: (saved.hidden ?? []).filter((id) => DEFAULT_ORDER.includes(id)),
      };
    }
    // v1 stored only the visible cards, in order.
    const legacy = window.localStorage.getItem(LEGACY_LAYOUT_KEY);
    if (legacy) {
      const visible = (JSON.parse(legacy) as string[]).filter((id) => DEFAULT_ORDER.includes(id));
      const hidden = DEFAULT_ORDER.filter((id) => !visible.includes(id));
      return { order: [...visible, ...hidden], hidden };
    }
  } catch {
    // Fall through to the default layout.
  }
  return { order: DEFAULT_ORDER, hidden: [] };
}

function rowsFromResponse(response: any) {
  return Array.isArray(response) ? response : response?.data ?? [];
}

const widgetLabel = (id: string) => WIDGETS.find((widget) => widget.id === id)?.label ?? 'Card';

export default function AdminDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [focus, setFocus] = useState<DesignationGroup | null>(null);
  const [stackMode, setStackMode] = useState<'count' | 'share'>('count');
  const [loading, setLoading] = useState(true);
  // Bumped after every successful load so charts replay their entrance.
  const [replay, setReplay] = useState(0);
  const [layout, setLayout] = useState<Layout>({ order: DEFAULT_ORDER, hidden: [] });
  const [layoutReady, setLayoutReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done'>('idle');
  const { toast } = useToast();
  const notes = useDashboardToasts();
  const pushNote = notes.push;
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLayout(loadLayout());
    setLayoutReady(true);
    // After the entrance, drop the entrance class so reordering doesn't replay it.
    const timer = setTimeout(() => setEntered(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (layoutReady) window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }, [layout, layoutReady]);

  useFlipGrid(gridRef, `${layout.order.join(',')}|${layout.hidden.join(',')}`, entered);

  const loadDashboard = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const [employeeRows, projectRows, locationRows, designationRows] = await Promise.all([
        api.get('/employees'),
        api.get('/projects'),
        api.get('/locations'),
        api.get('/designations'),
      ]);
      setEmployees(rowsFromResponse(employeeRows));
      setProjects(rowsFromResponse(projectRows));
      setLocations(rowsFromResponse(locationRows));
      setDesignations(rowsFromResponse(designationRows));
      setReplay((n) => n + 1);
      if (refresh) pushNote('Dashboard refreshed');
    } catch (error: any) {
      toast(error.message || 'Could not load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, pushNote]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // "/" jumps to the table search, like most data tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/INPUT|SELECT|TEXTAREA/.test(target.tagName) || target.isContentEditable) return;
      if (!searchRef.current) return;
      event.preventDefault();
      searchRef.current.focus();
      searchRef.current.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const projectLocations = useMemo(
    () => locations.filter((location) => !filters.projectId || location.projectId === filters.projectId),
    [locations, filters.projectId],
  );

  useEffect(() => {
    if (filters.viewScope !== 'location') return;
    if (projectLocations.length === 0) {
      if (filters.locationId) setFilters((f) => ({ ...f, locationId: '' }));
      return;
    }
    if (!projectLocations.some((location) => location.id === filters.locationId)) {
      setFilters((f) => ({ ...f, locationId: projectLocations[0].id }));
    }
  }, [projectLocations, filters.locationId, filters.viewScope]);

  const designationOptions = useMemo(
    () => designations.filter((designation) => !filters.group || resolveDesignationGroup(designation.name) === filters.group),
    [designations, filters.group],
  );

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    if (filters.projectId && employee.projectId !== filters.projectId) return false;
    if (filters.viewScope === 'location' && filters.locationId && employee.locationId !== filters.locationId) return false;
    if (filters.group && resolveDesignationGroup(employee.designation?.name) !== filters.group) return false;
    if (filters.designationId && employee.designationId !== filters.designationId) return false;
    if (filters.status && employee.status !== filters.status) return false;
    if (filters.workforce && employee.workforceCategory !== filters.workforce) return false;
    return true;
  }), [employees, filters]);

  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter((employee) => employee.status === 'ACTIVE').length;
  const primaryCount = filteredEmployees.filter((employee) => employee.workforceCategory === 'PRIMARY').length;

  const groupSummary = useMemo<GroupDatum[]>(() => GROUPS.map((group) => {
    const count = filteredEmployees.filter((employee) => resolveDesignationGroup(employee.designation?.name) === group.name).length;
    return { group: group.name, count, percentage: percent(count, totalEmployees), color: group.color };
  }), [filteredEmployees, totalEmployees]);

  const countOf = (group: DesignationGroup) => groupSummary.find((row) => row.group === group)?.count ?? 0;
  const focusedGroup: DesignationGroup =
    (filters.group as DesignationGroup) ||
    (focus && countOf(focus) > 0 ? focus : null) ||
    groupSummary.find((row) => row.count > 0)?.group ||
    'SOC';

  const locationRows = useMemo<LocationDatum[]>(() => {
    const base = (filters.projectId ? projectLocations : locations).filter((location) => (
      filters.viewScope !== 'location' || !filters.locationId || location.id === filters.locationId
    ));
    const build = (id: string, name: string, match: (employee: any) => boolean) => {
      const row: LocationDatum = { id, location: name, total: 0 };
      GROUPS.forEach((group) => {
        const count = filteredEmployees.filter((employee) => match(employee) && resolveDesignationGroup(employee.designation?.name) === group.name).length;
        row[group.name] = count;
        row.total += count;
      });
      return row;
    };
    const rows = base.map((location) => build(location.id, location.name, (employee) => employee.locationId === location.id));
    if (filters.viewScope === 'all' && filteredEmployees.some((employee) => !employee.locationId)) {
      rows.push(build('unassigned', 'Unassigned', (employee) => !employee.locationId));
    }
    return rows.filter((row) => row.total > 0 || filters.projectId);
  }, [filteredEmployees, locations, projectLocations, filters.projectId, filters.viewScope, filters.locationId]);

  const designationDrilldown = useMemo<DrillDatum[]>(() => {
    const inGroup = filteredEmployees.filter((employee) => resolveDesignationGroup(employee.designation?.name) === focusedGroup);
    const map = new Map<string, DrillDatum>();
    inGroup.forEach((employee) => {
      const designation = employee.designation?.name ?? 'Unassigned designation';
      const id = employee.designationId ?? `unassigned:${designation}`;
      const row = map.get(id) ?? { id, designation, count: 0, percentage: 0 };
      row.count += 1;
      map.set(id, row);
    });
    return Array.from(map.values())
      .map((row) => ({ ...row, percentage: percent(row.count, inGroup.length) }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEmployees, focusedGroup]);

  const topDesignations = useMemo(() => {
    const result: Partial<Record<DesignationGroup, string>> = {};
    GROUPS.forEach((group) => {
      const counts = new Map<string, number>();
      filteredEmployees.forEach((employee) => {
        if (resolveDesignationGroup(employee.designation?.name) !== group.name) return;
        const name = employee.designation?.name ?? 'Unassigned designation';
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top) result[group.name] = top[0];
    });
    return result;
  }, [filteredEmployees]);

  const tableRows = useMemo<DistributionRow[]>(() => {
    const groupTotals = new Map<DesignationGroup, number>();
    const locationTotals = new Map<string, number>();
    filteredEmployees.forEach((employee) => {
      const group = resolveDesignationGroup(employee.designation?.name);
      groupTotals.set(group, (groupTotals.get(group) ?? 0) + 1);
      const loc = employee.locationId ?? 'unassigned';
      locationTotals.set(loc, (locationTotals.get(loc) ?? 0) + 1);
    });

    const map = new Map<string, DistributionRow>();
    filteredEmployees.forEach((employee) => {
      const group = resolveDesignationGroup(employee.designation?.name);
      const designation = employee.designation?.name ?? 'Unassigned designation';
      const key = `${group}__${employee.designationId ?? designation}__${employee.locationId ?? 'unassigned'}`;
      const row = map.get(key) ?? {
        key,
        group,
        designationId: employee.designationId ?? '',
        designation,
        locationId: employee.locationId ?? null,
        location: employee.location?.name ?? 'Unassigned',
        employeeCount: 0,
        percentage: 0,
        groupTotal: groupTotals.get(group) ?? 0,
        locationTotal: locationTotals.get(employee.locationId ?? 'unassigned') ?? 0,
        statusCounts: {},
      };
      row.employeeCount += 1;
      if (employee.status) row.statusCounts[employee.status] = (row.statusCounts[employee.status] ?? 0) + 1;
      map.set(key, row);
    });
    return Array.from(map.values()).map((row) => ({ ...row, percentage: percent(row.employeeCount, totalEmployees) }));
  }, [filteredEmployees, totalEmployees]);

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(employees.map((employee) => employee.status).filter(Boolean)));
    return STATUS_ORDER.concat(values.filter((status) => !STATUS_ORDER.includes(status)).sort());
  }, [employees]);

  const workforceOptions = useMemo(() => {
    const values = Array.from(new Set(employees.map((employee) => employee.workforceCategory).filter(Boolean)));
    return WORKFORCE_ORDER.concat(values.filter((category) => !WORKFORCE_ORDER.includes(category)).sort());
  }, [employees]);

  const selectedProject = projects.find((project) => project.id === filters.projectId);
  const selectedLocation = locations.find((location) => location.id === filters.locationId);
  const selectedDesignation = designations.find((designation) => designation.id === filters.designationId);
  const representedLocations = new Set(filteredEmployees.map((employee) => employee.locationId ?? 'unassigned')).size;
  const representedDesignations = new Set(filteredEmployees.map((employee) => employee.designationId ?? employee.designation?.name)).size;
  const representedGroups = groupSummary.filter((row) => row.count > 0).length;

  /* ---------- Actions ---------- */

  const applyFilters = (patch: Partial<Filters>, message?: string) => {
    const before = filters;
    setFilters((f) => ({ ...f, ...patch }));
    if (message) pushNote(message, () => setFilters(before));
  };

  const toggleFilter = (key: 'status' | 'workforce', value: string, message: string) => {
    if (filters[key] === value) applyFilters({ [key]: '' }, `${key === 'status' ? 'Status' : 'Category'} filter removed`);
    else applyFilters({ [key]: value }, message);
  };

  const selectFocus = (group: DesignationGroup) => {
    if (filters.group && filters.group !== group) {
      pushNote(`Group filter is set to ${filters.group}. Clear it to drill into ${group}.`);
      return;
    }
    setFocus(group);
  };

  const jumpTo = (id: string) => {
    if (layout.hidden.includes(id)) {
      pushNote(`${widgetLabel(id)} is hidden. Turn it on in Customize.`);
      return;
    }
    const el = cardRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    (el.firstElementChild as HTMLElement | null)?.animate(
      [{ boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.35)' }, { boxShadow: '0 0 0 12px rgba(37, 99, 235, 0)' }],
      { duration: 900, easing: EASE },
    );
  };

  const hideWidget = (id: string) => {
    setLayout((l) => ({ ...l, hidden: [...l.hidden.filter((x) => x !== id), id] }));
    pushNote(`${widgetLabel(id)} hidden`, () => setLayout((l) => ({ ...l, hidden: l.hidden.filter((x) => x !== id) })));
  };

  const toggleWidget = (id: string) => setLayout((l) => ({
    ...l,
    hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id],
  }));

  const closeCustomize = useCallback(() => setCustomizeOpen(false), []);

  async function exportDashboard() {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const generatedAt = new Date().toLocaleString();
    const scopeLabel = filters.viewScope === 'all' ? 'All Locations Combined View' : selectedLocation?.name ?? 'Individual Location View';
    const filenameDate = new Date().toISOString().slice(0, 10);

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Group-Based Workforce Dashboard'],
      ['Generated At', generatedAt],
      ['Project', selectedProject?.name ?? 'All projects'],
      ['Scope', scopeLabel],
      ['Designation Group', filters.group || 'All groups'],
      ['Designation', selectedDesignation?.name ?? 'All designations'],
      ['Status', filters.status || 'All statuses'],
      ['Workforce Category', filters.workforce || 'All categories'],
      [],
      ['Group', 'Employee Count', 'Percentage'],
      ...groupSummary.map((row) => [row.group, row.count, `${row.percentage}%`]),
      ['Total', totalEmployees, '100%'],
    ]);
    summarySheet['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Group Summary');

    const comparisonSheet = XLSX.utils.aoa_to_sheet([
      ['Group', ...locationRows.map((row) => row.location), 'Total'],
      ...GROUPS.map((group) => [
        group.name,
        ...locationRows.map((row) => row[group.name] ?? 0),
        locationRows.reduce((sum, row) => sum + Number(row[group.name] ?? 0), 0),
      ]),
      ['Total', ...locationRows.map((row) => row.total), totalEmployees],
    ]);
    comparisonSheet['!cols'] = [{ wch: 18 }, ...locationRows.map(() => ({ wch: 16 })), { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, comparisonSheet, 'Location Comparison');

    const drilldownSheet = XLSX.utils.json_to_sheet(
      designationDrilldown.map((row) => ({
        Group: focusedGroup,
        Designation: row.designation,
        'Employee Count': row.count,
        Percentage: `${row.percentage}%`,
      })),
    );
    drilldownSheet['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, drilldownSheet, 'Designation Drill Down');

    const detailsSheet = XLSX.utils.json_to_sheet(
      tableRows.map((row) => ({
        Group: row.group,
        Designation: row.designation,
        Location: row.location,
        'Employee Count': row.employeeCount,
        Percentage: `${row.percentage}%`,
        'Group Total': row.groupTotal,
      })),
    );
    detailsSheet['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Detailed Table');

    const employeesSheet = XLSX.utils.json_to_sheet(
      filteredEmployees.map((employee) => ({
        Code: employee.employeeCode,
        Name: employee.name,
        Email: employee.email,
        Group: resolveDesignationGroup(employee.designation?.name),
        Designation: employee.designation?.name ?? '',
        Location: employee.location?.name ?? 'Unassigned',
        Project: employee.project?.name ?? 'Unassigned',
        Status: employee.status,
        'Workforce Category': employee.workforceCategory,
      })),
    );
    employeesSheet['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 32 },
      { wch: 16 },
      { wch: 36 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, employeesSheet, 'Employees');

    XLSX.writeFile(workbook, `workforce-group-dashboard-${filenameDate}.xlsx`);
  }

  async function runExport() {
    if (exportState !== 'idle') return;
    setExportState('busy');
    try {
      await exportDashboard();
      setExportState('done');
      pushNote(`Exported ${totalEmployees.toLocaleString()} employees to Excel`);
      setTimeout(() => setExportState('idle'), 1600);
    } catch (error: any) {
      setExportState('idle');
      toast(error.message || 'Could not export the dashboard', 'error');
    }
  }

  /* ---------- Filter chips ---------- */

  const chips = [
    filters.projectId && { key: 'project', label: 'Project', value: selectedProject?.name ?? 'Selected', clear: { projectId: '', locationId: '' } },
    filters.viewScope === 'location' && { key: 'location', label: 'Location', value: selectedLocation?.name ?? 'None', clear: { viewScope: 'all' as const, locationId: '' } },
    filters.group && { key: 'group', label: 'Group', value: filters.group, clear: { group: '', designationId: '' } },
    filters.designationId && { key: 'designation', label: 'Designation', value: selectedDesignation?.name ?? 'Selected', clear: { designationId: '' } },
    filters.status && { key: 'status', label: 'Status', value: labelize(filters.status), clear: { status: '' } },
    filters.workforce && { key: 'workforce', label: 'Category', value: labelize(filters.workforce), clear: { workforce: '' } },
    filters.search && { key: 'search', label: 'Search', value: `“${filters.search}”`, clear: { search: '' } },
  ].filter(Boolean) as { key: string; label: string; value: string; clear: Partial<Filters> }[];

  const tableVersion = [
    filters.projectId, filters.viewScope, filters.locationId, filters.group,
    filters.designationId, filters.status, filters.workforce, replay,
  ].join('|');

  /* ---------- Cards ---------- */

  const groupDataView = (
    <DataTable head={['Group', 'Employees', 'Share']} rows={groupSummary.map((row) => [row.group, row.count, `${row.percentage}%`])} />
  );
  const locationDataView = (
    <DataTable
      head={['Location', ...GROUPS.map((group) => group.name), 'Total']}
      rows={locationRows.map((row) => [row.location, ...GROUPS.map((group) => row[group.name] ?? 0), row.total])}
    />
  );
  const drillDataView = (
    <DataTable
      head={['Designation', 'Employees', `Share of ${focusedGroup}`]}
      rows={designationDrilldown.map((row) => [row.designation, row.count, `${row.percentage}%`])}
    />
  );

  const badge = (text: string, tone: 'ok' | 'neutral') => (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold', tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f2f5f9] text-slate-500')}>{text}</span>
  );

  const WIDGET_CONTENT: Record<string, ReactNode> = {
    'stat-total': (
      <KpiCard
        icon={Users}
        label="Filtered Employees"
        value={totalEmployees}
        primary
        help={loading && !replay ? 'Loading data' : filters.viewScope === 'all' ? 'all selected locations' : selectedLocation?.name ?? 'selected location'}
        hint="Jump to table"
        onAction={() => jumpTo('table-distribution')}
        replay={replay}
        loading={loading}
      />
    ),
    'stat-active': (
      <KpiCard
        icon={Briefcase}
        label="Active Workforce"
        value={activeEmployees}
        active={filters.status === 'ACTIVE'}
        help={<>{badge(`${percent(activeEmployees, totalEmployees)}%`, 'ok')} of filtered set</>}
        hint={filters.status === 'ACTIVE' ? 'Remove filter' : 'Show active only'}
        onAction={() => toggleFilter('status', 'ACTIVE', 'Showing active employees only')}
        replay={replay}
        delay={60}
        loading={loading}
      />
    ),
    'stat-locations': (
      <KpiCard
        icon={MapPin}
        label="Locations"
        value={representedLocations}
        help="represented in filters"
        hint="Compare locations"
        onAction={() => jumpTo('chart-location-compare')}
        replay={replay}
        delay={120}
        loading={loading}
      />
    ),
    'stat-groups': (
      <KpiCard
        icon={Layers3}
        label="Groups"
        value={representedGroups}
        help="with employees"
        hint="See group summary"
        onAction={() => jumpTo('table-group-summary')}
        replay={replay}
        delay={180}
        loading={loading}
      />
    ),
    'stat-designations': (
      <KpiCard
        icon={Award}
        label="Designations"
        value={representedDesignations}
        help="distinct roles"
        hint="Open drill-down"
        onAction={() => jumpTo('chart-designation-drilldown')}
        replay={replay}
        delay={240}
        loading={loading}
      />
    ),
    'stat-primary': (
      <KpiCard
        icon={Filter}
        label="Primary Category"
        value={primaryCount}
        active={filters.workforce === 'PRIMARY'}
        help={<>{badge(`${percent(primaryCount, totalEmployees)}%`, 'neutral')} primary</>}
        hint={filters.workforce === 'PRIMARY' ? 'Remove filter' : 'Show primary only'}
        onAction={() => toggleFilter('workforce', 'PRIMARY', 'Showing primary category only')}
        replay={replay}
        delay={300}
        loading={loading}
      />
    ),
    'chart-group-pie': (
      <BentoCard
        title="Group-Wise Distribution"
        subtitle="Share of workforce by functional group"
        dataView={groupDataView}
        onHide={() => hideWidget('chart-group-pie')}
        loading={loading}
      >
        {(expanded) => (
          <DonutChart
            data={groupSummary}
            total={totalEmployees}
            replay={expanded ?? replay}
            delay={expanded ? 200 : 0}
            focus={focusedGroup}
            onSelect={selectFocus}
            size={expanded ? 240 : 196}
          />
        )}
      </BentoCard>
    ),
    'chart-group-bar': (
      <BentoCard
        title="Group-Wise Employee Count"
        subtitle="Click a bar to drill into its designations"
        dataView={groupDataView}
        onHide={() => hideWidget('chart-group-bar')}
        loading={loading}
      >
        {(expanded) => (
          <GroupBarChart
            data={groupSummary}
            total={totalEmployees}
            focus={focusedGroup}
            replay={expanded ?? replay}
            delay={expanded ? 200 : 150}
            onSelect={selectFocus}
            height={expanded ? 380 : 300}
          />
        )}
      </BentoCard>
    ),
    'chart-location-compare': (
      <BentoCard
        title="Multi-Location Comparison"
        subtitle="Click a segment to filter to it"
        dataView={locationDataView}
        onHide={() => hideWidget('chart-location-compare')}
        loading={loading}
        tools={(
          <div role="group" aria-label="Chart values" className="inline-flex rounded-[10px] bg-[#f2f5f9] p-[3px]">
            {(['count', 'share'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={stackMode === mode}
                onClick={() => setStackMode(mode)}
                className={cn(
                  'h-[26px] rounded-[7px] px-2.5 text-xs font-medium capitalize transition-[background-color,color,box-shadow] duration-200',
                  stackMode === mode ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,27,45,0.1)]' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      >
        {(expanded) => (
          <LocationStackChart
            rows={locationRows}
            mode={stackMode}
            replay={expanded ?? replay}
            delay={expanded ? 200 : 300}
            height={expanded ? 380 : 262}
            onSegment={(row, group) => applyFilters(
              { viewScope: 'location', locationId: row.id, group, designationId: '' },
              `Filtered to ${group} in ${row.location}`,
            )}
          />
        )}
      </BentoCard>
    ),
    'chart-designation-drilldown': (
      <BentoCard
        title={`${focusedGroup} Designation Drill-Down`}
        subtitle={designationDrilldown.length
          ? `${countOf(focusedGroup)} employees across ${designationDrilldown.length} designation${designationDrilldown.length > 1 ? 's' : ''} · click one to filter`
          : 'Designations within the selected group'}
        dataView={drillDataView}
        onHide={() => hideWidget('chart-designation-drilldown')}
        loading={loading}
      >
        {(expanded) => (
          <DrillDown
            rows={designationDrilldown}
            focus={focusedGroup}
            lockedGroup={filters.group}
            replay={expanded ?? replay}
            onFocus={selectFocus}
            onPick={(row) => {
              if (row.id.startsWith('unassigned:')) {
                pushNote('These employees have no designation to filter by.');
                return;
              }
              applyFilters({ group: focusedGroup, designationId: row.id }, `Showing ${row.designation} only`);
            }}
          />
        )}
      </BentoCard>
    ),
    'table-group-summary': (
      <BentoCard
        title="Group Summary"
        subtitle="Exact totals and share for the selected filters"
        onHide={() => hideWidget('table-group-summary')}
        loading={loading}
      >
        {(expanded) => (
          <GroupSummaryBlocks
            data={groupSummary}
            focus={focusedGroup}
            topDesignations={topDesignations}
            replay={expanded ?? replay}
            onSelect={selectFocus}
          />
        )}
      </BentoCard>
    ),
    'table-distribution': (
      <BentoCard
        title="Workforce Distribution Table"
        subtitle="Exact values by group, designation and location"
        onHide={() => hideWidget('table-distribution')}
        loading={loading}
      >
        {(expanded) => (
          <DistributionTable
            rows={tableRows}
            search={filters.search}
            onSearch={(search) => setFilters((f) => ({ ...f, search }))}
            searchRef={expanded ? { current: null } : searchRef}
            version={tableVersion}
            loading={loading}
            onFilterDesignation={(row) => applyFilters(
              { group: row.group, designationId: row.designationId },
              `Showing ${row.designation} only`,
            )}
            onFilterLocation={(row) => row.locationId && applyFilters(
              { viewScope: 'location', locationId: row.locationId },
              `Showing ${row.location} only`,
            )}
          />
        )}
      </BentoCard>
    ),
  };

  const visibleIds = layout.order.filter((id) => !layout.hidden.includes(id));
  const selectClass = (set: boolean) => cn(
    'h-[38px] rounded-[10px] border-[#e6eaf0] bg-white text-[13px] shadow-none transition-[border-color,box-shadow] hover:border-slate-300',
    'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15',
    set && 'border-primary/45 bg-[#fbfcff]',
  );

  return (
    <>
      <Topbar title="Workforce Dashboard" subtitle="Designation-group visual analytics across projects and locations" />
      <TooltipProvider>
        <main className={cn(inter.className, 'wd-root min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa] text-slate-900')}>
          <div className="mx-auto flex max-w-[1360px] flex-col gap-5 px-4 py-6 md:px-6 md:py-7">
            <header className="wd-enter flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-[-0.02em] text-slate-900 [text-wrap:balance]">Group-Based Workforce Visualizations</h2>
                <p className="mt-1.5 max-w-[64ch] text-[13.5px] leading-relaxed text-slate-500">
                  Workforce distribution across SOC, NOC, Infra, Application and Non-IT, by project, location, designation, status and workforce category.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <HeaderButton icon={SlidersHorizontal} onClick={() => setCustomizeOpen(true)}>Customize</HeaderButton>
                <HeaderButton icon={RefreshCw} spin={loading} disabled={loading} onClick={() => loadDashboard(true)}>Refresh</HeaderButton>
                <button
                  type="button"
                  onClick={runExport}
                  disabled={loading || totalEmployees === 0}
                  className={cn(
                    'inline-flex h-9 min-w-[132px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    exportState === 'done' ? 'bg-emerald-700' : 'bg-primary hover:bg-blue-700',
                  )}
                >
                  {exportState === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : exportState === 'done' ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {exportState === 'busy' ? 'Preparing…' : exportState === 'done' ? 'Exported' : 'Export Excel'}
                </button>
              </div>
            </header>

            <section className={cn(CARD_CLASS, 'wd-enter')} style={{ '--i': 1 } as CSSProperties} aria-label="Filters">
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <Field label="Project" htmlFor="wd-project">
                  <Select
                    id="wd-project"
                    className={selectClass(!!filters.projectId)}
                    value={filters.projectId}
                    onChange={(event) => applyFilters({ projectId: event.target.value, locationId: '' })}
                  >
                    <option value="">All projects</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </Select>
                </Field>
                <Field label="Location" htmlFor="wd-location">
                  <Select
                    id="wd-location"
                    className={selectClass(filters.viewScope === 'location')}
                    value={filters.locationId}
                    disabled={filters.viewScope === 'all'}
                    onChange={(event) => applyFilters({ locationId: event.target.value })}
                  >
                    {filters.viewScope === 'all' && <option value="">All locations</option>}
                    {filters.viewScope === 'location' && projectLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Designation Group" htmlFor="wd-group">
                  <Select
                    id="wd-group"
                    className={selectClass(!!filters.group)}
                    value={filters.group}
                    onChange={(event) => applyFilters({ group: event.target.value, designationId: '' })}
                  >
                    <option value="">All groups</option>
                    {GROUPS.map((group) => <option key={group.name} value={group.name}>{group.name}</option>)}
                  </Select>
                </Field>
                <Field label="Designation" htmlFor="wd-designation">
                  <Select
                    id="wd-designation"
                    className={selectClass(!!filters.designationId)}
                    value={filters.designationId}
                    onChange={(event) => applyFilters({ designationId: event.target.value })}
                  >
                    <option value="">All designations</option>
                    {designationOptions.map((designation) => <option key={designation.id} value={designation.id}>{designation.name}</option>)}
                  </Select>
                </Field>
                <Field label="Status" htmlFor="wd-status">
                  <Select
                    id="wd-status"
                    className={selectClass(!!filters.status)}
                    value={filters.status}
                    onChange={(event) => applyFilters({ status: event.target.value })}
                  >
                    <option value="">All statuses</option>
                    {statusOptions.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                  </Select>
                </Field>
                <Field label="Workforce Category" htmlFor="wd-workforce">
                  <Select
                    id="wd-workforce"
                    className={selectClass(!!filters.workforce)}
                    value={filters.workforce}
                    onChange={(event) => applyFilters({ workforce: event.target.value })}
                  >
                    <option value="">All categories</option>
                    {workforceOptions.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
                  </Select>
                </Field>
                <Field label="Table Search" htmlFor="wd-search">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="wd-search"
                      value={filters.search}
                      onChange={(event) => setFilters((f) => ({ ...f, search: event.target.value }))}
                      placeholder="Group, role, location"
                      className={cn(
                        'h-[38px] w-full rounded-[10px] border border-[#e6eaf0] bg-white pl-8 pr-3 text-[13px] transition-[border-color,box-shadow] hover:border-slate-300',
                        'focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15',
                        filters.search && 'border-primary/45 bg-[#fbfcff]',
                      )}
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6eaf0] pt-4">
                <div role="group" aria-label="View" className="flex w-full gap-1 rounded-xl bg-[#f2f5f9] p-1 sm:inline-flex sm:w-auto">
                  <ViewButton
                    icon={Globe2}
                    active={filters.viewScope === 'all'}
                    onClick={() => filters.viewScope !== 'all' && applyFilters({ viewScope: 'all', locationId: '' })}
                  >
                    All Locations Combined View
                  </ViewButton>
                  <ViewButton
                    icon={MapPin}
                    active={filters.viewScope === 'location'}
                    onClick={() => filters.viewScope !== 'location' && applyFilters({ viewScope: 'location', locationId: projectLocations[0]?.id ?? '' })}
                  >
                    Individual Location View
                  </ViewButton>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
                  {chips.length === 0 && <span>No filters applied</span>}
                  {chips.map((chip) => (
                    <span key={`${chip.key}:${chip.key === 'search' ? '' : chip.value}`} className="wd-chip-in inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-[#eef3fe] pl-2.5 pr-1 text-primary">
                      <span className="truncate">{chip.label}: <b className="font-semibold">{chip.value}</b></span>
                      <button
                        type="button"
                        aria-label={`Remove ${chip.label} filter`}
                        onClick={() => applyFilters(chip.clear)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-primary/10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {chips.length > 0 && (
                    <button type="button" onClick={() => applyFilters(EMPTY_FILTERS, 'All filters cleared')} className="px-1 font-medium text-primary hover:underline">
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div ref={gridRef} className="relative grid grid-flow-dense grid-cols-12 gap-4">
              {visibleIds.map((id, index) => {
                const widget = WIDGETS.find((item) => item.id === id);
                if (!widget) return null;
                return (
                  <div
                    key={id}
                    data-flip={id}
                    ref={(el) => { cardRefs.current[id] = el; }}
                    className={cn(widget.span, 'min-w-0', !entered && 'wd-enter')}
                    style={{ '--i': index + 2 } as CSSProperties}
                  >
                    {WIDGET_CONTENT[id]}
                  </div>
                );
              })}
              {visibleIds.length === 0 && (
                <div className={cn(CARD_CLASS, 'col-span-12 items-center py-12 text-center text-[13px] text-slate-500')}>
                  Every card is hidden.
                  <button type="button" onClick={() => setCustomizeOpen(true)} className="mt-2 font-medium text-primary hover:underline">
                    Open Customize to turn some back on
                  </button>
                </div>
              )}
            </div>
          </div>

          <CustomizeDrawer
            open={customizeOpen}
            onClose={closeCustomize}
            widgets={WIDGETS}
            order={layout.order}
            hidden={layout.hidden}
            onReorder={(order) => setLayout((l) => ({ ...l, order }))}
            onToggle={toggleWidget}
            onReset={() => setLayout({ order: DEFAULT_ORDER, hidden: [] })}
          />
          <ToastStack items={notes.items} dismiss={notes.dismiss} />
        </main>
      </TooltipProvider>
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function HeaderButton({
  icon: Icon,
  spin,
  disabled,
  onClick,
  children,
}: {
  icon: typeof RefreshCw;
  spin?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#e6eaf0] bg-white px-3.5 text-[13px] font-medium transition-colors hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon className={cn('h-[15px] w-[15px] text-slate-500', spin && 'animate-spin')} />
      {children}
    </button>
  );
}

function ViewButton({ icon: Icon, active, onClick, children }: { icon: typeof MapPin; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 sm:flex-none',
        active ? 'bg-primary text-white shadow-[0_1px_3px_rgba(37,99,235,0.3)]' : 'text-slate-500 hover:text-slate-900',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{children}</span>
    </button>
  );
}
