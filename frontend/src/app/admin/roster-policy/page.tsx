'use client';
import { useEffect, useMemo, useState } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const defaultDistribution = { A: 40, B: 40, C: 20 };

export default function RosterPolicyPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [policy, setPolicy] = useState<any>(null);
  const [requirements, setRequirements] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
      setLocationId((current) => rows.some((location: any) => location.id === current) ? current : rows[0]?.id ?? '');
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !locationId) return;
    Promise.all([
      api.get(`/roster-policies?projectId=${projectId}&locationId=${locationId}`),
      api.get(`/shifts?locationId=${locationId}`),
    ]).then(([policyData, shiftData]) => {
      const nextPolicy = policyData?.[0] ?? null;
      setPolicy(nextPolicy);
      setShifts(Array.isArray(shiftData) ? shiftData : shiftData.data ?? []);
      const nextRequirements: Record<string, number> = {};
      for (const item of nextPolicy?.designationRequirements ?? []) {
        nextRequirements[`${item.shiftId}:${item.designationId}`] = item.requiredCount;
      }
      setRequirements(nextRequirements);
    });
  }, [projectId, locationId]);

  const distribution = useMemo(() => policy?.shiftDistributionJson ?? defaultDistribution, [policy]);

  const updatePolicy = (key: string, value: any) => setPolicy((current: any) => ({ ...(current ?? {}), [key]: value }));
  const updateDistribution = (code: string, value: number) => updatePolicy('shiftDistributionJson', { ...distribution, [code]: value });

  const savePolicy = async () => {
    if (!projectId || !locationId) return toast('Select project and location', 'error');
    setSaving(true);
    try {
      const designationRequirements = Object.entries(requirements)
        .filter(([, count]) => Number(count) > 0)
        .map(([key, requiredCount]) => {
          const [shiftId, designationId] = key.split(':');
          return { shiftId, designationId, requiredCount: Number(requiredCount), dayType: 'ANY' };
        });
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
        designationRequirements,
      };
      const saved = policy?.id ? await api.put(`/roster-policies/${policy.id}`, body) : await api.post('/roster-policies', body);
      setPolicy(saved);
      toast('Roster policy saved', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar title="Roster Policy" subtitle="Configure weekly roster rules per Project and Location" />
      <main className="p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </Select>
              </div>
              <Button onClick={savePolicy} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" />Save Policy
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" />Capacity Rules</CardTitle>
              <CardDescription>These values drive preview, publish, analytics, and export for the selected location.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2 rounded-md border p-3 md:col-span-2">
                <Label>Controls</Label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(policy?.generalBufferEnabled ?? true)} onChange={(e) => updatePolicy('generalBufferEnabled', e.target.checked)} /> General/Buffer enabled</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(policy?.allowExtraDuty ?? true)} onChange={(e) => updatePolicy('allowExtraDuty', e.target.checked)} /> Allow extra duty</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(policy?.allowOvertime ?? true)} onChange={(e) => updatePolicy('allowOvertime', e.target.checked)} /> Allow overtime</label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shift Distribution</CardTitle>
              <CardDescription>Operational shift split is converted into dynamic daily targets during preview.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {['A', 'B', 'C'].map((code) => {
                const shift = shifts.find((item) => item.code === code);
                return (
                  <div key={code} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">{code}</Badge>
                      <span className="text-xs text-muted-foreground">{shift?.name ?? 'Not configured'}</span>
                    </div>
                    <Input type="number" min={0} value={distribution[code] ?? 0} onChange={(e) => updateDistribution(code, Number(e.target.value))} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Designation Requirements</CardTitle>
            <CardDescription>Minimum required employees per designation for every configured shift.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  {designations.map((designation) => <TableHead key={designation.id}>{designation.name}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.filter((shift) => ['A', 'B', 'C'].includes(shift.code)).map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.code} - {shift.name}</TableCell>
                    {designations.map((designation) => {
                      const key = `${shift.id}:${designation.id}`;
                      return (
                        <TableCell key={designation.id}>
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={requirements[key] ?? 0}
                            onChange={(e) => setRequirements((current) => ({ ...current, [key]: Number(e.target.value) }))}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
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
