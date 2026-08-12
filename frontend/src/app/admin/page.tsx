'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Briefcase,
  Download,
  Filter,
  Layers3,
  MapPin,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Table2,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Topbar } from '@/components/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginationControls, PaginationMeta } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { SortDir, filterByQuery, sortRows } from '@/lib/table-tools';
import { useToast } from '@/components/ui/toast';

type DesignationGroup = 'SOC' | 'NOC' | 'Infra' | 'Application' | 'Non-IT';
type ViewScope = 'all' | 'location';

const GROUPS: { name: DesignationGroup; color: string; soft: string }[] = [
  { name: 'SOC', color: '#2563eb', soft: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'NOC', color: '#0891b2', soft: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { name: 'Infra', color: '#7c3aed', soft: 'bg-violet-50 text-violet-700 border-violet-200' },
  { name: 'Application', color: '#059669', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Non-IT', color: '#d97706', soft: 'bg-amber-50 text-amber-700 border-amber-200' },
];

const GROUP_COLORS = Object.fromEntries(GROUPS.map((group) => [group.name, group.color])) as Record<DesignationGroup, string>;
const STATUS_ORDER = ['ACTIVE', 'ON_LEAVE', 'PROBATION', 'TRAINING', 'BENCH', 'SUSPENDED', 'RESIGNED'];
const WORKFORCE_ORDER = ['PRIMARY', 'BACKUP', 'CONTRACTOR', 'INTERN', 'TEMPORARY'];

const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

function rowsFromResponse(response: any) {
  return Array.isArray(response) ? response : response?.data ?? [];
}

function labelize(value: string) {
  if (!value) return 'All';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function percent(count: number, total: number) {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function resolveDesignationGroup(name?: string): DesignationGroup {
  const text = String(name ?? '').toUpperCase();
  if (/\bSOC\b/.test(text)) return 'SOC';
  if (text.includes('NON-IT') || text.includes('NON IT')) return 'Non-IT';
  if (/\bOSS\b/.test(text) || /\bNOC\b/.test(text)) return 'NOC';
  if (/\bEMS\b/.test(text) || text.includes('APPLICATION') || /\bAPP\b/.test(text)) return 'Application';
  if (
    text.includes('INFRA') ||
    text.includes('SERVER') ||
    text.includes('STORAGE') ||
    text.includes('BACKUP') ||
    text.includes('NETWORK') ||
    text.includes('VIRTUAL') ||
    text.includes('CLOUD') ||
    text.includes('DR/BCP') ||
    /\bDR\b/.test(text)
  ) {
    return 'Infra';
  }
  return 'Application';
}

export default function AdminDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [viewScope, setViewScope] = useState<ViewScope>('all');
  const [locationId, setLocationId] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [workforceFilter, setWorkforceFilter] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState('employeeCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function loadDashboard() {
    try {
      setLoading(true);
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
    } catch (error: any) {
      toast(error.message || 'Could not load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const projectLocations = useMemo(
    () => locations.filter((location) => !projectId || location.projectId === projectId),
    [locations, projectId],
  );

  useEffect(() => {
    if (viewScope !== 'location') return;
    if (projectLocations.length === 0) {
      setLocationId('');
      return;
    }
    if (!projectLocations.some((location) => location.id === locationId)) {
      setLocationId(projectLocations[0].id);
    }
  }, [projectLocations, locationId, viewScope]);

  useEffect(() => {
    setPage(1);
  }, [projectId, viewScope, locationId, groupFilter, designationFilter, statusFilter, workforceFilter, tableSearch, pageSize]);

  const designationOptions = useMemo(
    () => designations.filter((designation) => !groupFilter || resolveDesignationGroup(designation.name) === groupFilter),
    [designations, groupFilter],
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const group = resolveDesignationGroup(employee.designation?.name);
      if (projectId && employee.projectId !== projectId) return false;
      if (viewScope === 'location' && locationId && employee.locationId !== locationId) return false;
      if (groupFilter && group !== groupFilter) return false;
      if (designationFilter && employee.designationId !== designationFilter) return false;
      if (statusFilter && employee.status !== statusFilter) return false;
      if (workforceFilter && employee.workforceCategory !== workforceFilter) return false;
      return true;
    });
  }, [employees, projectId, viewScope, locationId, groupFilter, designationFilter, statusFilter, workforceFilter]);

  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter((employee) => employee.status === 'ACTIVE').length;

  const groupSummary = useMemo(() => {
    return GROUPS.map((group) => {
      const count = filteredEmployees.filter((employee) => resolveDesignationGroup(employee.designation?.name) === group.name).length;
      return {
        group: group.name,
        count,
        percentage: percent(count, totalEmployees),
        fill: group.color,
      };
    });
  }, [filteredEmployees, totalEmployees]);

  const focusedGroup = (groupFilter || groupSummary.find((row) => row.count > 0)?.group || 'SOC') as DesignationGroup;

  const locationRows = useMemo(() => {
    const baseLocations = (projectId ? projectLocations : locations).filter((location) => {
      if (viewScope !== 'location') return true;
      return !locationId || location.id === locationId;
    });
    const rows = baseLocations.map((location) => {
      const row: Record<string, any> = { id: location.id, location: location.name, total: 0 };
      GROUPS.forEach((group) => {
        const count = filteredEmployees.filter((employee) => {
          return employee.locationId === location.id && resolveDesignationGroup(employee.designation?.name) === group.name;
        }).length;
        row[group.name] = count;
        row.total += count;
      });
      return row;
    });

    const hasUnassigned = filteredEmployees.some((employee) => !employee.locationId);
    if (hasUnassigned && viewScope === 'all') {
      const row: Record<string, any> = { id: 'unassigned', location: 'Unassigned', total: 0 };
      GROUPS.forEach((group) => {
        const count = filteredEmployees.filter((employee) => {
          return !employee.locationId && resolveDesignationGroup(employee.designation?.name) === group.name;
        }).length;
        row[group.name] = count;
        row.total += count;
      });
      rows.push(row);
    }

    return rows.filter((row) => row.total > 0 || projectId);
  }, [filteredEmployees, locations, projectId, projectLocations, viewScope, locationId]);

  const designationDrilldown = useMemo(() => {
    const map = new Map<string, any>();
    filteredEmployees
      .filter((employee) => resolveDesignationGroup(employee.designation?.name) === focusedGroup)
      .forEach((employee) => {
        const designation = employee.designation?.name ?? 'Unassigned designation';
        const key = employee.designationId ?? designation;
        const row = map.get(key) ?? { designation, count: 0, percentage: 0 };
        row.count += 1;
        map.set(key, row);
      });
    const rows = Array.from(map.values()).map((row) => ({
      ...row,
      percentage: percent(row.count, Math.max(1, filteredEmployees.filter((employee) => resolveDesignationGroup(employee.designation?.name) === focusedGroup).length)),
    }));
    return sortRows(rows, 'count', 'desc');
  }, [filteredEmployees, focusedGroup]);

  const tableRows = useMemo(() => {
    const groupTotals = new Map<DesignationGroup, number>();
    filteredEmployees.forEach((employee) => {
      const group = resolveDesignationGroup(employee.designation?.name);
      groupTotals.set(group, (groupTotals.get(group) ?? 0) + 1);
    });

    const map = new Map<string, any>();
    filteredEmployees.forEach((employee) => {
      const group = resolveDesignationGroup(employee.designation?.name);
      const designation = employee.designation?.name ?? 'Unassigned designation';
      const location = employee.location?.name ?? 'Unassigned';
      const key = `${group}__${employee.designationId ?? designation}__${employee.locationId ?? 'unassigned'}`;
      const row = map.get(key) ?? {
        key,
        group,
        designation,
        location,
        employeeCount: 0,
        percentage: 0,
        groupTotal: groupTotals.get(group) ?? 0,
      };
      row.employeeCount += 1;
      map.set(key, row);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      percentage: percent(row.employeeCount, totalEmployees),
      groupTotal: groupTotals.get(row.group) ?? row.groupTotal,
    }));
  }, [filteredEmployees, totalEmployees]);

  const searchedRows = useMemo(
    () => filterByQuery(tableRows, tableSearch, ['group', 'designation', 'location']),
    [tableRows, tableSearch],
  );
  const sortedRows = useMemo(() => sortRows(searchedRows, sortKey, sortDir), [searchedRows, sortKey, sortDir]);
  const pagedRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page, pageSize],
  );
  const tableMeta = useMemo(
    () => ({
      ...emptyMeta,
      page,
      pageSize,
      total: sortedRows.length,
      totalPages: Math.max(1, Math.ceil(sortedRows.length / pageSize)),
    }),
    [page, pageSize, sortedRows.length],
  );

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(employees.map((employee) => employee.status).filter(Boolean)));
    return STATUS_ORDER.concat(values.filter((status) => !STATUS_ORDER.includes(status)).sort());
  }, [employees]);

  const workforceOptions = useMemo(() => {
    const values = Array.from(new Set(employees.map((employee) => employee.workforceCategory).filter(Boolean)));
    return WORKFORCE_ORDER.concat(values.filter((category) => !WORKFORCE_ORDER.includes(category)).sort());
  }, [employees]);

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const representedLocations = new Set(filteredEmployees.map((employee) => employee.locationId ?? 'unassigned')).size;
  const representedDesignations = new Set(filteredEmployees.map((employee) => employee.designationId ?? employee.designation?.name)).size;
  const representedGroups = groupSummary.filter((row) => row.count > 0).length;
  const primaryCount = filteredEmployees.filter((employee) => employee.workforceCategory === 'PRIMARY').length;

  async function exportDashboard() {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const generatedAt = new Date().toLocaleString();
    const scopeLabel = viewScope === 'all' ? 'All Locations Combined View' : selectedLocation?.name ?? 'Individual Location View';
    const filenameDate = new Date().toISOString().slice(0, 10);

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Group-Based Workforce Dashboard'],
      ['Generated At', generatedAt],
      ['Project', selectedProject?.name ?? 'All projects'],
      ['Scope', scopeLabel],
      ['Designation Group', groupFilter || 'All groups'],
      ['Designation', designations.find((designation) => designation.id === designationFilter)?.name ?? 'All designations'],
      ['Status', statusFilter || 'All statuses'],
      ['Workforce Category', workforceFilter || 'All categories'],
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

  return (
    <>
      <Topbar title="Workforce Dashboard" subtitle="Designation-group visual analytics across projects and locations" />
      <main className="space-y-5 p-4 md:p-6">
        <Card className="overflow-hidden border-slate-200">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers3 className="h-5 w-5 text-primary" />
                  Group-Based Workforce Visualizations
                </CardTitle>
                <CardDescription>
                  View SOC, NOC, Infra, Application, and Non-IT distribution by project, location, designation, status, and workforce category.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={loadDashboard} disabled={loading}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Refresh
                </Button>
                <Button type="button" onClick={exportDashboard} disabled={loading || filteredEmployees.length === 0}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={viewScope === 'all' ? 'default' : 'outline'}
                onClick={() => { setViewScope('all'); setLocationId(''); }}
              >
                All Locations Combined View
              </Button>
              <Button
                type="button"
                variant={viewScope === 'location' ? 'default' : 'outline'}
                onClick={() => setViewScope('location')}
              >
                Individual Location View
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
              <FilterField label="Project">
                <Select value={projectId} onChange={(event) => { setProjectId(event.target.value); setLocationId(''); }}>
                  <option value="">All projects</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Location">
                <Select
                  value={locationId}
                  disabled={viewScope === 'all'}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  {viewScope === 'all' && <option value="">All locations</option>}
                  {viewScope === 'location' && projectLocations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Designation Group">
                <Select value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setDesignationFilter(''); }}>
                  <option value="">All groups</option>
                  {GROUPS.map((group) => <option key={group.name} value={group.name}>{group.name}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Designation">
                <Select value={designationFilter} onChange={(event) => setDesignationFilter(event.target.value)}>
                  <option value="">All designations</option>
                  {designationOptions.map((designation) => <option key={designation.id} value={designation.id}>{designation.name}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Workforce Category">
                <Select value={workforceFilter} onChange={(event) => setWorkforceFilter(event.target.value)}>
                  <option value="">All categories</option>
                  {workforceOptions.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Table Search">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Group, role, location" />
                </div>
              </FilterField>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={Users} label="Filtered Employees" value={totalEmployees} helper={loading ? 'Loading data' : viewScope === 'all' ? 'all selected locations' : selectedLocation?.name ?? 'selected location'} />
          <StatCard icon={Briefcase} label="Active Workforce" value={activeEmployees} helper={`${percent(activeEmployees, totalEmployees)}% of filtered set`} />
          <StatCard icon={MapPin} label="Locations" value={representedLocations} helper="represented in filters" />
          <StatCard icon={Layers3} label="Groups" value={representedGroups} helper="with employees" />
          <StatCard icon={Award} label="Designations" value={representedDesignations} helper="distinct roles" />
          <StatCard icon={Filter} label="Primary Category" value={primaryCount} helper={`${percent(primaryCount, totalEmployees)}% primary`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            icon={PieChartIcon}
            title="Group-Wise Distribution"
            description="Donut view of selected workforce by functional group"
          >
            {totalEmployees > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupSummary.filter((row) => row.count > 0)}
                    dataKey="count"
                    nameKey="group"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                    onClick={(row: any) => setGroupFilter(row.group)}
                  >
                    {groupSummary.filter((row) => row.count > 0).map((row) => (
                      <Cell key={row.group} fill={row.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} employees`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>

          <ChartCard
            icon={BarChart3}
            title="Group-Wise Employee Count"
            description="Bar chart for exact comparison between SOC, NOC, Infra, Application, and Non-IT"
          >
            {totalEmployees > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupSummary}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} onClick={(row: any) => setGroupFilter(row.group)}>
                    {groupSummary.map((row) => <Cell key={row.group} fill={row.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <ChartCard
            icon={MapPin}
            title="Multi-Location Comparison"
            description="Stacked bar chart comparing group count across locations"
          >
            {locationRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationRows} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="location" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={58} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Legend />
                  {GROUPS.map((group) => (
                    <Bar key={group.name} dataKey={group.name} stackId="workforce" fill={group.color} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>

          <ChartCard
            icon={Award}
            title={`${focusedGroup} Designation Drill-Down`}
            description="Click a group in the charts, or choose a group filter, to drill into designation counts"
          >
            {designationDrilldown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={designationDrilldown.slice(0, 10)} layout="vertical" margin={{ left: 100, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="designation" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" fill={GROUP_COLORS[focusedGroup]} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="h-4 w-4 text-primary" />
                Group Summary
              </CardTitle>
              <CardDescription>Exact totals and percentage share for the selected filters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupSummary.map((row) => {
                const group = GROUPS.find((item) => item.name === row.group)!;
                return (
                  <button
                    type="button"
                    key={row.group}
                    onClick={() => setGroupFilter(row.group)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 ${groupFilter === row.group ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.fill }} />
                        <span className="font-medium">{row.group}</span>
                      </div>
                      <Badge variant="outline">{row.count}</Badge>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${row.percentage}%`, backgroundColor: row.fill }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.percentage}% of filtered workforce</div>
                  </button>
                );
              })}
              {groupFilter && (
                <Button type="button" variant="outline" className="w-full" onClick={() => { setGroupFilter(''); setDesignationFilter(''); }}>
                  Clear Group Drill-Down
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Table2 className="h-4 w-4 text-primary" />
                    Workforce Distribution Table
                  </CardTitle>
                  <CardDescription>Sortable, searchable, paginated exact values by group, designation, and location</CardDescription>
                </div>
                <Select
                  value={`${sortKey}:${sortDir}`}
                  onChange={(event) => {
                    const [key, dir] = event.target.value.split(':');
                    setSortKey(key);
                    setSortDir(dir as SortDir);
                  }}
                  className="w-56"
                >
                  <option value="employeeCount:desc">Count high-low</option>
                  <option value="employeeCount:asc">Count low-high</option>
                  <option value="percentage:desc">Percentage high-low</option>
                  <option value="group:asc">Group A-Z</option>
                  <option value="designation:asc">Designation A-Z</option>
                  <option value="location:asc">Location A-Z</option>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Employee Count</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                    <TableHead className="text-right">Group Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {loading ? 'Loading dashboard data...' : 'No workforce rows match the selected filters.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {pagedRows.map((row) => {
                    const group = GROUPS.find((item) => item.name === row.group)!;
                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${group.soft}`}>
                            {row.group}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{row.designation}</TableCell>
                        <TableCell>{row.location}</TableCell>
                        <TableCell className="text-right font-semibold">{row.employeeCount}</TableCell>
                        <TableCell className="text-right">{row.percentage}%</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.groupTotal}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationControls
                meta={tableMeta}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, helper }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ icon: Icon, title, description, children }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
      No chart data for the selected filters.
    </div>
  );
}
