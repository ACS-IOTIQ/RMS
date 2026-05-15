'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Save, Settings2, Upload } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { api, apiBlob } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { SortDir, sortRows } from '@/lib/table-tools';

const ALL_LOCATIONS = '__ALL_LOCATIONS__';
const defaultDistribution = { A: 40, B: 40, C: 20 };
const shiftColumns = ['shift id', 'shiftid', 'shift code', 'shiftcode', 'code', 'shift', 'shift name', 'shiftname', 'name'];
const locationHeaderClasses = [
  'border-sky-200 bg-sky-50 text-sky-900',
  'border-emerald-200 bg-emerald-50 text-emerald-900',
  'border-violet-200 bg-violet-50 text-violet-900',
  'border-amber-200 bg-amber-50 text-amber-900',
  'border-rose-200 bg-rose-50 text-rose-900',
  'border-cyan-200 bg-cyan-50 text-cyan-900',
  'border-lime-200 bg-lime-50 text-lime-900',
  'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900',
];
const shiftToneClasses: Record<string, { header: string; cell: string; input: string }> = {
  A: {
    header: 'border-sky-200 bg-sky-100 text-sky-950',
    cell: 'border-sky-100 bg-sky-50/45',
    input: 'focus-visible:ring-sky-300',
  },
  B: {
    header: 'border-amber-200 bg-amber-100 text-amber-950',
    cell: 'border-amber-100 bg-amber-50/50',
    input: 'focus-visible:ring-amber-300',
  },
  C: {
    header: 'border-indigo-200 bg-indigo-100 text-indigo-950',
    cell: 'border-indigo-100 bg-indigo-50/50',
    input: 'focus-visible:ring-indigo-300',
  },
};
const defaultShiftTone = {
  header: 'border-slate-200 bg-slate-100 text-slate-900',
  cell: 'border-slate-100 bg-slate-50/50',
  input: 'focus-visible:ring-slate-300',
};

function normalizeCell(value: any) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getFlexibleCell(row: Record<string, any>, names: string[]) {
  const wanted = names.map((name) => normalizeCell(name).replace(/[\s_-]/g, ''));
  const key = Object.keys(row).find((item) => wanted.includes(normalizeCell(item).replace(/[\s_-]/g, '')));
  return key ? String(row[key] ?? '').trim() : '';
}

function parseCount(value: any) {
  if (value === null || value === undefined || String(value).trim() === '') return 0;
  const count = Number(value);
  return Number.isFinite(count) && Number.isInteger(count) && count >= 0 ? count : null;
}

function shiftLabel(shift: any) {
  if (shift?.code === 'A') return 'Morning';
  if (shift?.code === 'B') return 'Afternoon';
  if (shift?.code === 'C') return 'Night';
  if (shift?.code === 'G') return 'General';
  return shift?.name ?? shift?.code ?? 'Shift';
}

function shiftTone(shift: any) {
  return shiftToneClasses[String(shift?.code ?? '')] ?? defaultShiftTone;
}

function safeWholeNumber(value: any) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function effectiveCellCount(cell: any) {
  return safeWholeNumber(cell?.manualCount ?? cell?.suggestedCount ?? 0);
}

function calculatePolicyShiftTargets(policy: any, shifts: any[]) {
  const headcount = safeWholeNumber(policy?.requiredDailyHeadcount ?? 0);
  const distribution = policy?.shiftDistributionJson ?? defaultDistribution;
  const weightedShifts = shifts
    .map((shift, index) => ({
      shift,
      index,
      weight: Number(distribution?.[shift.code] ?? 0),
    }))
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0);
  const totalWeight = weightedShifts.reduce((sum, item) => sum + item.weight, 0);
  const targets = new Map<string, number>();
  for (const item of shifts) targets.set(item.id, 0);
  if (!headcount || !totalWeight) return targets;

  const rawTargets = weightedShifts.map((item) => {
    const raw = (headcount * item.weight) / totalWeight;
    return {
      ...item,
      raw,
      floor: Math.floor(raw),
      rounded: Math.round(raw),
      remainder: raw - Math.floor(raw),
    };
  });
  const useLargestRemainder = String(policy?.roundingPolicy ?? 'LARGEST_REMAINDER_DESIGNATION_PRIORITY') === 'LARGEST_REMAINDER';
  const baseTargets = useLargestRemainder
    ? rawTargets.map((item) => ({ ...item, count: item.floor }))
    : rawTargets.map((item) => ({ ...item, count: item.rounded }));

  let difference = headcount - baseTargets.reduce((sum, item) => sum + item.count, 0);
  if (difference > 0) {
    const increaseOrder = [...baseTargets].sort((a, b) => (b.remainder - a.remainder) || (b.weight - a.weight) || (a.index - b.index));
    for (let index = 0; difference > 0 && increaseOrder.length; index += 1, difference -= 1) {
      increaseOrder[index % increaseOrder.length].count += 1;
    }
  }
  if (difference < 0) {
    const decreaseOrder = [...baseTargets].sort((a, b) => (a.remainder - b.remainder) || (a.weight - b.weight) || (b.index - a.index));
    for (let index = 0; difference < 0 && decreaseOrder.length; index += 1) {
      const item = decreaseOrder[index % decreaseOrder.length];
      if (item.count <= 0) continue;
      item.count -= 1;
      difference += 1;
    }
  }

  for (const item of baseTargets) targets.set(item.shift.id, item.count);
  return targets;
}

function distributionSummary(distribution: any) {
  return ['A', 'B', 'C'].map((code) => `${shiftLabel({ code })} ${safeWholeNumber(distribution?.[code] ?? 0)}%`).join(' / ');
}

export default function RosterPolicyPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState(ALL_LOCATIONS);
  const [policy, setPolicy] = useState<any>(null);
  const [requirements, setRequirements] = useState<Record<string, number>>({});
  const [allLocationsData, setAllLocationsData] = useState<any>(null);
  const [capacityRulesOpen, setCapacityRulesOpen] = useState(false);
  const [shiftDistributionOpen, setShiftDistributionOpen] = useState(false);
  const [requirementSort, setRequirementSort] = useState('code:asc');
  const [designationSort, setDesignationSort] = useState('level:asc');
  const [requirementUploadOpen, setRequirementUploadOpen] = useState(false);
  const [requirementUploadFile, setRequirementUploadFile] = useState('');
  const [requirementPreview, setRequirementPreview] = useState<{
    rows: { shiftId?: string; shiftLabel: string; counts: Record<string, number>; total: number; errors: string[] }[];
    errors: string[];
    requirements: Record<string, number>;
  } | null>(null);
  const [uploadingRequirements, setUploadingRequirements] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isAllLocations = locationId === ALL_LOCATIONS;

  useEffect(() => {
    Promise.all([api.get('/projects'), api.get('/designations')]).then(([projectData, designationData]) => {
      setProjects(projectData);
      setDesignations(Array.isArray(designationData) ? designationData : designationData.data ?? []);
      if (projectData[0]) setProjectId(projectData[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/locations?projectId=${projectId}`).then((data) => {
      const rows = Array.isArray(data) ? data : data.data ?? [];
      setLocations(rows);
      setLocationId((current) => {
        if (!current || current === ALL_LOCATIONS) return ALL_LOCATIONS;
        return rows.some((location: any) => location.id === current) ? current : ALL_LOCATIONS;
      });
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !locationId) return;
    if (isAllLocations) {
      loadAllLocations();
      return;
    }
    Promise.all([
      api.get(`/roster-policies?projectId=${projectId}&locationId=${locationId}`),
      api.get(`/shifts?locationId=${locationId}`),
    ]).then(([policyData, shiftData]) => {
      const nextPolicy = policyData?.[0] ?? null;
      setPolicy(nextPolicy);
      setAllLocationsData(null);
      setShifts(Array.isArray(shiftData) ? shiftData : shiftData.data ?? []);
      const nextRequirements: Record<string, number> = {};
      for (const item of nextPolicy?.designationRequirements ?? []) {
        nextRequirements[`${item.shiftId}:${item.designationId}`] = item.requiredCount;
      }
      setRequirements(nextRequirements);
    });
  }, [projectId, locationId]);

  const loadAllLocations = async () => {
    if (!projectId) return;
    const data = await api.get(`/roster-policies/all-locations?projectId=${projectId}`);
    setAllLocationsData(data);
    setPolicy(data.policy);
    setShifts(data.shifts ?? []);
    setRequirements({});
  };

  const distribution = useMemo(() => policy?.shiftDistributionJson ?? defaultDistribution, [policy]);
  const [requirementSortKey, requirementSortDir] = requirementSort.split(':') as [string, SortDir];
  const [designationSortKey, designationSortDir] = designationSort.split(':') as [string, SortDir];
  const visibleRequirementShifts = useMemo(
    () => sortRows(shifts, requirementSortKey, requirementSortDir),
    [shifts, requirementSortKey, requirementSortDir],
  );
  const visibleDesignations = useMemo(
    () => sortRows(designations, designationSortKey, designationSortDir),
    [designations, designationSortKey, designationSortDir],
  );

  const updatePolicy = (key: string, value: any) => setPolicy((current: any) => ({ ...(current ?? {}), [key]: value }));
  const updateDistribution = (code: string, value: number) => updatePolicy('shiftDistributionJson', { ...distribution, [code]: value });

  const buildDesignationRequirements = (sourceRequirements: Record<string, number>) => Object.entries(sourceRequirements)
    .filter(([, count]) => Number(count) > 0)
    .map(([key, requiredCount]) => {
      const [shiftId, designationId] = key.split(':');
      return { shiftId, designationId, requiredCount: Number(requiredCount), dayType: 'ANY' };
    });

  const savePolicy = async (sourceRequirements = requirements) => {
    if (!projectId || !locationId || isAllLocations) return toast('Select project and location', 'error');
    setSaving(true);
    try {
      const body = {
        projectId,
        locationId,
        requiredDailyHeadcount: Number(policy?.requiredDailyHeadcount ?? 49),
        workingDaysPerEmployee: Number(policy?.workingDaysPerEmployee ?? 6),
        weeklyOffsPerEmployee: Number(policy?.weeklyOffsPerEmployee ?? Math.max(0, 7 - Number(policy?.workingDaysPerEmployee ?? 6))),
        shiftDistributionJson: distribution,
        roundingPolicy: policy?.roundingPolicy ?? 'LARGEST_REMAINDER_DESIGNATION_PRIORITY',
        generalBufferEnabled: Boolean(policy?.generalBufferEnabled ?? true),
        allowExtraDuty: Boolean(policy?.allowExtraDuty ?? true),
        allowOvertime: Boolean(policy?.allowOvertime ?? true),
        weekStartDay: policy?.weekStartDay ?? 'MONDAY',
        designationRequirements: buildDesignationRequirements(sourceRequirements),
      };
      const saved = policy?.id ? await api.put(`/roster-policies/${policy.id}`, body) : await api.post('/roster-policies', body);
      setPolicy(saved);
      setRequirements(sourceRequirements);
      toast('Roster policy saved', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const buildAllLocationBody = () => ({
    projectId,
    requiredDailyHeadcount: Number(policy?.requiredDailyHeadcount ?? 49),
    workingDaysPerEmployee: Number(policy?.workingDaysPerEmployee ?? 6),
    weeklyOffsPerEmployee: Number(policy?.weeklyOffsPerEmployee ?? Math.max(0, 7 - Number(policy?.workingDaysPerEmployee ?? 6))),
    shiftDistributionJson: distribution,
    roundingPolicy: policy?.roundingPolicy ?? 'LARGEST_REMAINDER_DESIGNATION_PRIORITY',
    generalBufferEnabled: Boolean(policy?.generalBufferEnabled ?? true),
    allowExtraDuty: Boolean(policy?.allowExtraDuty ?? true),
    allowOvertime: Boolean(policy?.allowOvertime ?? true),
    weekStartDay: policy?.weekStartDay ?? 'MONDAY',
    minimumRestHours: Number(policy?.minimumRestHours ?? 12),
    projectLevel247Enabled: Boolean(policy?.projectLevel247Enabled ?? true),
    designationPolicies: allLocationsData?.designationPolicies?.map((row: any) => ({
      designationId: row.designationId,
      coverageMode: row.coverageMode ?? 'PROJECT_SHARED',
    })) ?? [],
    cells: allLocationsData?.cells?.map((cell: any) => ({
      locationId: cell.locationId,
      shiftId: cell.shiftId,
      designationId: cell.designationId,
      manualCount: cell.manualCount ?? null,
      overrideReason: cell.overrideReason || null,
    })) ?? [],
  });

  const saveAllLocationDraft = async (silent = false) => {
    if (!allLocationsData?.policy?.id) return null;
    setSaving(true);
    try {
      const saved = await api.put(`/roster-policies/all-locations/${allLocationsData.policy.id}`, buildAllLocationBody());
      setAllLocationsData(saved);
      setPolicy(saved.policy);
      if (!silent) toast('All Locations draft saved', 'success');
      return saved;
    } catch (e: any) {
      toast(e.message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const generateCoverage = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const data = await api.post('/roster-policies/all-locations/generate', buildAllLocationBody());
      setAllLocationsData(data);
      setPolicy(data.policy);
      toast('Coverage generated into table', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyAllLocations = async () => {
    const saved = await saveAllLocationDraft(true);
    if (!saved?.policy?.id) return;
    try {
      const data = await api.post(`/roster-policies/all-locations/${saved.policy.id}/apply`);
      setAllLocationsData(data);
      setPolicy(data.policy);
      toast(`Applied ${data.appliedSummary?.appliedCells ?? 0} grid cell(s)`, 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const exportAllLocations = async () => {
    const saved = await saveAllLocationDraft(true);
    if (!saved?.policy?.id) return;
    const blob = await apiBlob(`/roster-policies/all-locations/${saved.policy.id}/export`);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-locations-policy-${projectId}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const rowTotal = (shiftId: string, sourceRequirements = requirements) => visibleDesignations.reduce((sum, designation) => {
    return sum + Number(sourceRequirements[`${shiftId}:${designation.id}`] ?? 0);
  }, 0);

  const downloadRequirementTemplate = async () => {
    if (!shifts.length || !designations.length) return toast('Configure shifts and designations before downloading the template', 'error');
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const rows = sortRows(shifts, 'code', 'asc').map((shift) => {
      const row: Record<string, any> = {
        'Shift Code': shift.code,
        'Shift Name': shift.name,
        'Shift ID': shift.id,
      };
      for (const designation of sortRows(designations, 'level', 'asc')) {
        row[designation.name] = requirements[`${shift.id}:${designation.id}`] ?? 0;
      }
      row.Total = sortRows(designations, 'level', 'asc').reduce((sum, designation) => sum + Number(row[designation.name] ?? 0), 0);
      return row;
    });
    const instructions = [
      ['How to fill'],
      ['Keep Shift Code, Shift Name, or Shift ID so rows can be matched.'],
      ['Designation columns are matched by name, case-insensitively. Column order does not matter.'],
      ['Use whole numbers only. Blank cells are treated as zero. The Total column is ignored during upload.'],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Requirements');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');
    XLSX.writeFile(workbook, `designation-requirements-${locationId || 'location'}.xlsx`);
  };

  const parseRequirementFile = async (file: File) => {
    const XLSX = await import('xlsx');
    setRequirementUploadFile(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    const errors: string[] = [];
    const nextRequirements: Record<string, number> = {};
    const shiftById = new Map(shifts.map((shift) => [normalizeCell(shift.id), shift]));
    const shiftByCode = new Map(shifts.map((shift) => [normalizeCell(shift.code), shift]));
    const shiftByName = new Map(shifts.map((shift) => [normalizeCell(shift.name), shift]));
    const designationByKey = new Map<string, any>();
    for (const designation of designations) {
      designationByKey.set(normalizeCell(designation.name), designation);
      designationByKey.set(normalizeCell(designation.id), designation);
    }
    const parsedRows = rows.map((row, index) => {
      const rowNumber = index + 2;
      const shiftIdValue = getFlexibleCell(row, ['Shift ID', 'shiftId']);
      const shiftCodeValue = getFlexibleCell(row, ['Shift Code', 'code']);
      const shiftNameValue = getFlexibleCell(row, ['Shift Name', 'shift']);
      const shift = shiftById.get(normalizeCell(shiftIdValue))
        ?? shiftByCode.get(normalizeCell(shiftCodeValue))
        ?? shiftByName.get(normalizeCell(shiftNameValue));
      const rowErrors: string[] = [];
      if (!shift) rowErrors.push(`Row ${rowNumber}: shift not found`);

      const counts: Record<string, number> = {};
      let total = 0;
      for (const column of Object.keys(row)) {
        const normalizedColumn = normalizeCell(column).replace(/[\s_-]/g, '');
        if (shiftColumns.map((item) => item.replace(/[\s_-]/g, '')).includes(normalizedColumn) || normalizedColumn === 'total') continue;
        const designation = designationByKey.get(normalizeCell(column));
        if (!designation) {
          rowErrors.push(`Row ${rowNumber}: designation column "${column}" not found`);
          continue;
        }
        const count = parseCount(row[column]);
        if (count === null) {
          rowErrors.push(`Row ${rowNumber}: ${designation.name} must be a whole number`);
          continue;
        }
        counts[designation.id] = count;
        total += count;
        if (shift) nextRequirements[`${shift.id}:${designation.id}`] = count;
      }
      errors.push(...rowErrors);
      return {
        shiftId: shift?.id,
        shiftLabel: shift ? `${shift.code} - ${shift.name}` : (shiftCodeValue || shiftNameValue || `Row ${rowNumber}`),
        counts,
        total,
        errors: rowErrors,
      };
    });
    if (!rows.length) errors.push('File does not contain any requirement rows');
    setRequirementPreview({ rows: parsedRows, errors, requirements: nextRequirements });
    setRequirementUploadOpen(true);
  };

  const uploadRequirementPreview = async () => {
    if (!requirementPreview || requirementPreview.errors.length) return;
    setUploadingRequirements(true);
    try {
      await savePolicy(requirementPreview.requirements);
      setRequirementUploadOpen(false);
      setRequirementPreview(null);
      setRequirementUploadFile('');
    } finally {
      setUploadingRequirements(false);
    }
  };

  const updateManualCell = (cellId: string, value: string) => {
    const manualCount = value.trim() === '' ? null : Math.max(0, Number(value));
    setAllLocationsData((current: any) => ({
      ...current,
      cells: (current?.cells ?? []).map((cell: any) => cell.id === cellId ? { ...cell, manualCount } : cell),
    }));
  };

  const allCellMap = useMemo(() => new Map((allLocationsData?.cells ?? []).map((cell: any) => [`${cell.locationId}:${cell.shiftId}:${cell.designationId}`, cell])), [allLocationsData]);

  const operationalShifts = (location: any) => (location?.shifts ?? [])
    .filter((shift: any) => ['A', 'B', 'C'].includes(String(shift.code)) && Number(distribution[shift.code] ?? 0) > 0)
    .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));

  const matrixLocations = useMemo(() => {
    return allLocationsData?.locations ?? [];
  }, [allLocationsData]);

  const matrixDesignations = useMemo(() => {
    return allLocationsData?.designations ?? [];
  }, [allLocationsData]);

  return (
    <>
      <Topbar title="Roster Policy" subtitle="Configure weekly roster rules by location or across all project locations" />
      <main className="space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value={ALL_LOCATIONS}>All Locations</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </Select>
              </div>
              <Button onClick={() => isAllLocations ? saveAllLocationDraft() : savePolicy()} disabled={saving || (!policy && !allLocationsData)}>
                <Save className="mr-1.5 h-4 w-4" />{isAllLocations ? 'Save Draft' : 'Save Policy'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
          <Card className="overflow-hidden">
            <CardHeader className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" />Capacity Rules</CardTitle>
                  <CardDescription>
                    {isAllLocations ? 'Draft values apply when Apply to Locations is used.' : 'These values drive the selected location.'}
                    <span className="mt-1 block font-medium text-foreground">
                      Daily {safeWholeNumber(policy?.requiredDailyHeadcount ?? 49)} / Workdays {safeWholeNumber(policy?.workingDaysPerEmployee ?? 6)} / Offs {safeWholeNumber(policy?.weeklyOffsPerEmployee ?? 1)}
                    </span>
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setCapacityRulesOpen((open) => !open)}
                  aria-expanded={capacityRulesOpen}
                  title={capacityRulesOpen ? 'Collapse capacity rules' : 'Expand capacity rules'}
                >
                  {capacityRulesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {capacityRulesOpen && (
              <CardContent className="grid gap-4 border-t p-4 md:grid-cols-2">
                <Field label="Required daily headcount" value={policy?.requiredDailyHeadcount ?? 49} onChange={(value) => updatePolicy('requiredDailyHeadcount', Number(value))} />
                <Field label="Working days / employee" value={policy?.workingDaysPerEmployee ?? 6} onChange={(value) => updatePolicy('workingDaysPerEmployee', Number(value))} />
                <Field label="Weekly offs / employee" value={policy?.weeklyOffsPerEmployee ?? 1} onChange={(value) => updatePolicy('weeklyOffsPerEmployee', Number(value))} />
                <div className="space-y-1.5">
                  <Label>Rounding policy</Label>
                  <Select value={policy?.roundingPolicy ?? 'LARGEST_REMAINDER_DESIGNATION_PRIORITY'} onChange={(e) => updatePolicy('roundingPolicy', e.target.value)}>
                    <option value="LARGEST_REMAINDER_DESIGNATION_PRIORITY">Largest remainder + designation priority</option>
                    <option value="LARGEST_REMAINDER">Largest remainder</option>
                    <option value="BUSINESS_PRIORITY">Business priority</option>
                    <option value="DESIGNATION_PRIORITY">Designation priority</option>
                    <option value="MANUAL_FIXED_COUNT">Manual fixed count</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Week start day</Label>
                  <Select value={policy?.weekStartDay ?? 'MONDAY'} onChange={(e) => updatePolicy('weekStartDay', e.target.value)}>
                    {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => <option key={day}>{day}</option>)}
                  </Select>
                </div>
                {isAllLocations && (
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm md:col-span-2">
                    <input type="checkbox" checked={Boolean(policy?.projectLevel247Enabled ?? true)} onChange={(e) => updatePolicy('projectLevel247Enabled', e.target.checked)} />
                    Project-level 24/7 designation coverage
                  </label>
                )}
                <div className="space-y-2 rounded-md border p-3 md:col-span-2">
                  <Label>Controls</Label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(policy?.generalBufferEnabled ?? true)} onChange={(e) => updatePolicy('generalBufferEnabled', e.target.checked)} /> General/Buffer enabled</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(policy?.allowExtraDuty ?? true)} onChange={(e) => updatePolicy('allowExtraDuty', e.target.checked)} /> Allow extra duty</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(policy?.allowOvertime ?? true)} onChange={(e) => updatePolicy('allowOvertime', e.target.checked)} /> Allow overtime</label>
                </div>
              </CardContent>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">Shift Distribution</CardTitle>
                  <CardDescription>
                    {distributionSummary(distribution)}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setShiftDistributionOpen((open) => !open)}
                  aria-expanded={shiftDistributionOpen}
                  title={shiftDistributionOpen ? 'Collapse shift distribution' : 'Expand shift distribution'}
                >
                  {shiftDistributionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {shiftDistributionOpen && (
              <CardContent className="grid gap-3 border-t p-4 md:grid-cols-3">
                {['A', 'B', 'C'].map((code) => {
                  const shift = shifts.find((item) => item.code === code);
                  return (
                    <div key={code} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant="outline">{shiftLabel({ code })}</Badge>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">{shift?.name ?? 'Policy shift'}</span>
                      </div>
                      <Input type="number" min={0} value={distribution[code] ?? 0} onChange={(e) => updateDistribution(code, Number(e.target.value))} />
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        </div>

        {isAllLocations ? (
          <AllLocationsWorkspace
            data={allLocationsData}
            matrixLocations={matrixLocations}
            matrixDesignations={matrixDesignations}
            operationalShifts={operationalShifts}
            cellMap={allCellMap}
            updateManualCell={updateManualCell}
            generateCoverage={generateCoverage}
            saveDraft={() => saveAllLocationDraft()}
            applyAllLocations={applyAllLocations}
            exportAllLocations={exportAllLocations}
            saving={saving}
          />
        ) : (
          <IndividualLocationRequirements
            shifts={visibleRequirementShifts}
            designations={visibleDesignations}
            requirements={requirements}
            setRequirements={setRequirements}
            rowTotal={rowTotal}
            requirementSort={requirementSort}
            setRequirementSort={setRequirementSort}
            designationSort={designationSort}
            setDesignationSort={setDesignationSort}
            downloadRequirementTemplate={downloadRequirementTemplate}
            parseRequirementFile={parseRequirementFile}
          />
        )}

        <Dialog open={requirementUploadOpen} onOpenChange={setRequirementUploadOpen}>
          <DialogContent className="flex h-[85vh] max-w-6xl grid-rows-none flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Validate Designation Requirements</DialogTitle>
              <DialogDescription>
                {requirementUploadFile ? `File: ${requirementUploadFile}` : 'Review the parsed requirement counts before saving.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Rows Parsed</div>
                  <div className="text-2xl font-semibold">{requirementPreview?.rows.length ?? 0}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Total Headcount</div>
                  <div className="text-2xl font-semibold">{requirementPreview?.rows.reduce((sum, row) => sum + row.total, 0) ?? 0}</div>
                </div>
                <div className={`rounded-md border p-3 ${requirementPreview?.errors.length ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className={`text-xs ${requirementPreview?.errors.length ? 'text-destructive' : 'text-emerald-700'}`}>Issues</div>
                  <div className={`text-2xl font-semibold ${requirementPreview?.errors.length ? 'text-destructive' : 'text-emerald-700'}`}>{requirementPreview?.errors.length ?? 0}</div>
                </div>
              </div>
              {requirementPreview?.errors.length ? (
                <div className="max-h-36 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {requirementPreview.errors.map((error) => <div key={error}>{error}</div>)}
                </div>
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Validation passed. These counts are ready to upload into the selected roster policy.
                </div>
              )}
              <div className="max-h-[45vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Shift</TableHead>
                      {visibleDesignations.map((designation) => <TableHead key={designation.id}>{designation.name}</TableHead>)}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirementPreview?.rows.map((row, index) => (
                      <TableRow key={`${row.shiftLabel}-${index}`} className={row.errors.length ? 'bg-destructive/5' : undefined}>
                        <TableCell className="font-medium">{row.shiftLabel}</TableCell>
                        {visibleDesignations.map((designation) => (
                          <TableCell key={designation.id}>{row.counts[designation.id] ?? 0}</TableCell>
                        ))}
                        <TableCell className="font-semibold">{row.total}</TableCell>
                      </TableRow>
                    ))}
                    {!requirementPreview?.rows.length && (
                      <TableRow><TableCell colSpan={visibleDesignations.length + 2} className="py-8 text-center text-muted-foreground">No rows parsed.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setRequirementUploadOpen(false)}>Cancel</Button>
              <Button type="button" disabled={!requirementPreview || requirementPreview.errors.length > 0 || uploadingRequirements} onClick={uploadRequirementPreview}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />Upload Requirements
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

function IndividualLocationRequirements({
  shifts,
  designations,
  requirements,
  setRequirements,
  rowTotal,
  requirementSort,
  setRequirementSort,
  designationSort,
  setDesignationSort,
  downloadRequirementTemplate,
  parseRequirementFile,
}: any) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Designation Requirements</CardTitle>
            <CardDescription>Minimum required employees per designation for every configured shift.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadRequirementTemplate}>
              <Download className="mr-1.5 h-4 w-4" />Template
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              <Upload className="mr-1.5 h-4 w-4" />Upload
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (file) parseRequirementFile(file);
                }}
              />
            </label>
            <Select value={requirementSort} onChange={(e) => setRequirementSort(e.target.value)} className="w-44">
              <option value="code:asc">Shift A-Z</option>
              <option value="name:asc">Shift name A-Z</option>
            </Select>
            <Select value={designationSort} onChange={(e) => setDesignationSort(e.target.value)} className="w-52">
              <option value="level:asc">Designation level low-high</option>
              <option value="level:desc">Designation level high-low</option>
              <option value="name:asc">Designation A-Z</option>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift</TableHead>
              {designations.map((designation: any) => <TableHead key={designation.id}>{designation.name}</TableHead>)}
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift: any) => (
              <TableRow key={shift.id}>
                <TableCell className="font-medium">{shift.code} - {shift.name}</TableCell>
                {designations.map((designation: any) => {
                  const key = `${shift.id}:${designation.id}`;
                  return (
                    <TableCell key={designation.id}>
                      <Input
                        type="number"
                        min={0}
                        className="w-24"
                        value={requirements[key] ?? 0}
                        onChange={(e) => setRequirements((current: any) => ({ ...current, [key]: Number(e.target.value) }))}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="font-semibold">{rowTotal(shift.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AllLocationsWorkspace({
  data,
  matrixLocations,
  matrixDesignations,
  operationalShifts,
  cellMap,
  updateManualCell,
  generateCoverage,
  saveDraft,
  applyAllLocations,
  exportAllLocations,
  saving,
}: any) {
  const locationTotals = useMemo(() => {
    return matrixLocations.map((location: any) => {
      const shifts = operationalShifts(location);
      const shiftTargets = calculatePolicyShiftTargets(data?.policy, shifts);
      const shiftTotals = new Map<string, number>();
      let plannedTotal = 0;

      for (const shift of shifts) {
        const total = matrixDesignations.reduce((sum: number, designation: any) => {
          const cell = cellMap.get(`${location.id}:${shift.id}:${designation.id}`);
          return sum + effectiveCellCount(cell);
        }, 0);
        shiftTotals.set(shift.id, total);
        plannedTotal += total;
      }

      return {
        locationId: location.id,
        shifts,
        shiftTotals,
        shiftTargets,
        plannedTotal,
        targetTotal: shifts.reduce((sum: number, shift: any) => sum + Number(shiftTargets.get(shift.id) ?? 0), 0),
      };
    });
  }, [cellMap, data?.policy, matrixDesignations, matrixLocations, operationalShifts]);

  const matrixColumnCount = useMemo(() => {
    return 1 + matrixLocations.reduce((sum: number, location: any) => sum + Math.max(1, operationalShifts(location).length), 0);
  }, [matrixLocations, operationalShifts]);

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Loading All Locations policy...</CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-base">All Locations Requirement Matrix</CardTitle>
              <CardDescription>Enter the shift-wise designation counts manually, like an Excel sheet.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={generateCoverage} disabled={saving}>Generate Coverage</Button>
              <Button type="button" variant="outline" onClick={saveDraft} disabled={saving}><Save className="mr-1.5 h-4 w-4" />Save Draft</Button>
              <Button type="button" onClick={applyAllLocations} disabled={saving}>Apply to Locations</Button>
              <Button type="button" variant="outline" onClick={exportAllLocations} disabled={saving}><Download className="mr-1.5 h-4 w-4" />Export</Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="overflow-auto p-0">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="sticky left-0 z-20 min-w-64 border bg-background align-bottom uppercase tracking-wide">
                  Designation
                </TableHead>
                {matrixLocations.map((location: any, index: number) => {
                  const shifts = operationalShifts(location);
                  return (
                    <TableHead
                      key={location.id}
                      colSpan={Math.max(1, shifts.length)}
                      className={`border text-center uppercase tracking-wide ${locationHeaderClasses[index % locationHeaderClasses.length]}`}
                    >
                      {location.name}
                    </TableHead>
                  );
                })}
              </TableRow>
              <TableRow>
                {matrixLocations.map((location: any) => {
                  const shifts = operationalShifts(location);
                  if (!shifts.length) return <TableHead key={`${location.id}-empty`} className="min-w-32 border text-center text-muted-foreground">No shifts</TableHead>;
                  return shifts.map((shift: any) => {
                    const tone = shiftTone(shift);
                    return (
                      <TableHead key={`${location.id}-${shift.id}`} className={`min-w-32 border text-center font-medium uppercase tracking-wide ${tone.header}`}>
                        {shiftLabel(shift)}
                      </TableHead>
                    );
                  });
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrixDesignations.map((designation: any) => {
                return (
                  <TableRow key={designation.id} className="hover:bg-transparent">
                    <TableCell className="sticky left-0 z-10 border bg-white font-medium">
                      {designation.name}
                    </TableCell>
                    {matrixLocations.map((location: any) => {
                      const shifts = operationalShifts(location);
                      if (!shifts.length) return <TableCell key={`${location.id}-empty-${designation.id}`} className="border text-center text-xs text-muted-foreground">-</TableCell>;
                      return shifts.map((shift: any) => {
                        const cell = cellMap.get(`${location.id}:${shift.id}:${designation.id}`);
                        const tone = shiftTone(shift);
                        return (
                          <TableCell key={`${location.id}-${shift.id}-${designation.id}`} className={`border p-1 align-middle ${tone.cell}`}>
                            {cell ? (
                              <Input
                                type="number"
                                min={0}
                                className={`h-8 w-full rounded-none border-0 bg-white/80 text-center shadow-none focus-visible:ring-1 ${tone.input}`}
                                value={cell.manualCount ?? cell.suggestedCount ?? 0}
                                onChange={(e) => updateManualCell(cell.id, e.target.value)}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">No cell</span>
                            )}
                          </TableCell>
                        );
                      });
                    })}
                  </TableRow>
                );
              })}
              {matrixDesignations.length === 0 && (
                <TableRow><TableCell colSpan={matrixColumnCount} className="py-8 text-center text-muted-foreground">No rows match the selected view.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-muted/40">
                <TableCell className="sticky left-0 z-20 border bg-muted font-semibold">
                  Shift totals
                </TableCell>
                {matrixLocations.map((location: any, index: number) => {
                  const summary = locationTotals[index];
                  if (!summary?.shifts.length) {
                    return <TableCell key={`${location.id}-totals-empty`} className="border text-center text-xs text-muted-foreground">-</TableCell>;
                  }
                  return summary.shifts.map((shift: any) => {
                    const total = summary.shiftTotals.get(shift.id) ?? 0;
                    const target = summary.shiftTargets.get(shift.id) ?? 0;
                    const tone = shiftTone(shift);
                    return (
                      <TableCell key={`${location.id}-${shift.id}-total`} className={`border p-2 text-center ${tone.cell}`}>
                        <div className="text-sm font-semibold">{total}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Target {target}</div>
                      </TableCell>
                    );
                  });
                })}
              </TableRow>
              <TableRow className="hover:bg-muted/40">
                <TableCell className="sticky left-0 z-20 border bg-muted font-semibold">
                  Location totals
                </TableCell>
                {matrixLocations.map((location: any, index: number) => {
                  const summary = locationTotals[index];
                  const span = Math.max(1, summary?.shifts.length ?? 0);
                  return (
                    <TableCell key={`${location.id}-location-total`} colSpan={span} className="border bg-white p-2 text-center">
                      <div className="text-sm font-semibold">Total {summary?.plannedTotal ?? 0}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Policy target {summary?.targetTotal ?? 0}</div>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
