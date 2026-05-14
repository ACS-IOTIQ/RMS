'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, MapPin, MoreVertical, Pencil, Search, Settings2, Trash2, Users } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PaginationControls, PaginationMeta } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { SortDir, filterByQuery, sortRows } from '@/lib/table-tools';

const emptyForm = { name: '', projectId: '', timezone: 'Asia/Kolkata', capacity: 100, weeklyOffPolicy: 'ROTATING', fixedWeeklyOffDay: 0 };
const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export default function LocationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [workforceOpen, setWorkforceOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [workforce, setWorkforce] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [assignmentTab, setAssignmentTab] = useState<'assigned' | 'unassigned'>('assigned');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateDesignation, setCandidateDesignation] = useState('');
  const [candidateDepartment, setCandidateDepartment] = useState('');
  const [candidateShift, setCandidateShift] = useState('');
  const [candidateStatus, setCandidateStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const load = async () => {
    const res = await api.get(`/locations?page=${page}&pageSize=${pageSize}`);
    setItems(res.data ?? []);
    setMeta(res.meta ?? emptyMeta);
  };

  useEffect(() => {
    load();
    Promise.all([api.get('/projects'), api.get('/designations')]).then(([p, d]) => {
      setProjects(p);
      setDesignations(d);
    });
  }, []);
  useEffect(() => { load(); }, [page, pageSize]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const visibleItems = useMemo(() => {
    const scoped = projectFilter ? items.filter((location) => location.projectId === projectFilter) : items;
    return sortRows(filterByQuery(scoped, search, ['name', 'project.name', 'timezone']), sortKey, sortDir);
  }, [items, projectFilter, search, sortKey, sortDir]);

  const openNew = () => {
    const next = { ...emptyForm, projectId: projects[0]?.id ?? '' };
    setEditing(null);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const openEdit = (location: any) => {
    const next = {
      name: location.name,
      projectId: location.projectId,
      timezone: location.timezone,
      capacity: location.capacity,
      weeklyOffPolicy: location.weeklyOffPolicy ?? 'ROTATING',
      fixedWeeklyOffDay: location.fixedWeeklyOffDay ?? 0,
    };
    setEditing(location);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const closeModal = () => { setOpen(false); setConfirmOpen(false); };
  const requestClose = () => dirty ? setConfirmOpen(true) : closeModal();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form, capacity: Number(form.capacity), fixedWeeklyOffDay: Number(form.fixedWeeklyOffDay) };
      if (editing) {
        delete payload.projectId;
        await api.put(`/locations/${editing.id}`, payload);
      } else {
        await api.post('/locations', payload);
      }
      toast(editing ? 'Updated' : 'Created', 'success');
      closeModal();
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete location and all its shifts?')) return;
    try { await api.del(`/locations/${id}`); toast('Deleted', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const openView = async (location: any) => {
    setSelected(location);
    setSelectedDetails(null);
    setViewOpen(true);
    setSelectedDetails(await api.get(`/locations/${location.id}`));
  };

  const openWorkforce = async (location: any) => {
    setSelected(location);
    setWorkforce(null);
    setWorkforceOpen(true);
    setWorkforce(await api.get(`/locations/${location.id}/workforce`));
  };

  const openAssignments = async (location: any) => {
    setSelected(location);
    setSelectedDetails(await api.get(`/locations/${location.id}`));
    setAssignmentTab('assigned');
    setCandidateSearch('');
    setCandidateDesignation('');
    setCandidateDepartment('');
    setCandidateShift('');
    setCandidateStatus('');
    setSelectedIds([]);
    setTargetDepartmentId('');
    setAssignmentOpen(true);
  };

  const departments = selectedDetails?.departments ?? [];
  const shifts = selectedDetails?.shifts ?? [];

  const loadCandidates = async () => {
    if (!selected) return;
    const params = new URLSearchParams();
    params.set('tab', assignmentTab);
    if (candidateSearch) params.set('search', candidateSearch);
    if (candidateDesignation) params.set('designationId', candidateDesignation);
    if (candidateDepartment) params.set('departmentId', candidateDepartment);
    if (candidateShift) params.set('shiftId', candidateShift);
    if (candidateStatus) params.set('status', candidateStatus);
    const data = await api.get(`/locations/${selected.id}/assignment-candidates?${params.toString()}`);
    setCandidates(data);
    setSelectedIds([]);
  };

  useEffect(() => { loadCandidates(); }, [selected, assignmentTab, candidateSearch, candidateDesignation, candidateDepartment, candidateShift, candidateStatus]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === candidates.length) setSelectedIds([]);
    else setSelectedIds(candidates.map((employee) => employee.id));
  };

  const applyAssignment = async () => {
    if (!selected || selectedIds.length === 0) return toast('Select at least one employee', 'error');
    try {
      if (assignmentTab === 'assigned') {
        await api.post(`/locations/${selected.id}/unassign-employees`, { employeeIds: selectedIds });
        toast(`Unassigned ${selectedIds.length} employee(s)`, 'success');
      } else {
        await api.post(`/locations/${selected.id}/assign-employees`, {
          employeeIds: selectedIds,
          departmentId: targetDepartmentId || null,
        });
        toast(`Assigned ${selectedIds.length} employee(s)`, 'success');
      }
      await Promise.all([loadCandidates(), load()]);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <Topbar title="Locations" subtitle="Operational sites, workforce, and shift applicability" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search locations..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-52">
              <option value="">All projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
            <Select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSortKey(key); setSortDir(dir as SortDir); }} className="w-48">
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="capacity:desc">Capacity high-low</option>
              <option value="_count.employees:desc">Employees high-low</option>
              <option value="_count.shifts:desc">Shifts high-low</option>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><MapPin className="h-4 w-4 mr-1.5" />Add Location</Button></DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Location' : 'New Location'}</DialogTitle>
                <DialogDescription>Locations are mapped to one project and drive roster eligibility.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Project</Label>
                  <Select required disabled={!!editing} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">Select project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={requestClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Project</TableHead><TableHead>Timezone</TableHead><TableHead>Capacity</TableHead><TableHead>Employees</TableHead><TableHead>Shifts</TableHead><TableHead>Departments</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No locations yet.</TableCell></TableRow>}
              {visibleItems.map((location) => (
                <TableRow key={location.id}>
                  <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><MapPin className="h-4 w-4" /></div><span className="font-medium">{location.name}</span></div></TableCell>
                  <TableCell>{location.project?.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{location.timezone}</TableCell>
                  <TableCell>{location.capacity}</TableCell>
                  <TableCell>{location._count?.employees ?? 0}</TableCell>
                  <TableCell>{location._count?.shifts ?? 0}</TableCell>
                  <TableCell>{location._count?.departments ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(location)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(location)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAssignments(location)}><Users className="h-4 w-4 mr-2" />Manage Employees</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openWorkforce(location)}><Users className="h-4 w-4 mr-2" />View Workforce</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push(`/admin/shifts?locationId=${location.id}`)}><Settings2 className="h-4 w-4 mr-2" />Configure Shifts</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/admin/designations')}><Settings2 className="h-4 w-4 mr-2" />Manage Designations</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(location.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={meta} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </CardContent></Card>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>If you go back now, all entered data will be discarded. Are you sure you want to continue?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Continue Editing</Button>
              <Button type="button" variant="destructive" onClick={closeModal}>Discard Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Location Details</DialogTitle><DialogDescription>{selected?.name}</DialogDescription></DialogHeader>
            {selectedDetails && (
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Project</div><div className="font-medium">{selectedDetails.project?.name}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Timezone</div><div className="font-medium">{selectedDetails.timezone}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Capacity</div><div className="font-medium">{selectedDetails.capacity}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Employees</div><div className="font-medium">{selectedDetails.employees?.length ?? 0}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Departments</div><div className="font-medium">{selectedDetails.departments?.length ?? 0}</div></div>
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Shifts</div><div className="font-medium">{selectedDetails.shifts?.length ?? 0}</div></div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={workforceOpen} onOpenChange={setWorkforceOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Workforce</DialogTitle><DialogDescription>{selected?.name}</DialogDescription></DialogHeader>
            {workforce && (
              <div className="space-y-4">
                <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Total employees</div><div className="text-2xl font-semibold">{workforce.employees}</div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">By Status</div>
                    {workforce.byStatus.map((row: any) => <div key={row.status} className="flex justify-between text-sm"><span>{row.status}</span><Badge variant="outline">{row.count}</Badge></div>)}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">By Designation</div>
                    {workforce.byDesignation.map((row: any) => <div key={row.designation} className="flex justify-between text-sm"><span>{row.designation}</span><Badge variant="outline">{row.count}</Badge></div>)}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader><DialogTitle>Manage Location Employees</DialogTitle><DialogDescription>{selected?.name}</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={assignmentTab === 'assigned' ? 'default' : 'outline'} onClick={() => setAssignmentTab('assigned')}>Assigned</Button>
                <Button type="button" variant={assignmentTab === 'unassigned' ? 'default' : 'outline'} onClick={() => setAssignmentTab('unassigned')}>Unassigned</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <Input placeholder="Search employees..." value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} />
                <Select value={candidateDesignation} onChange={(e) => setCandidateDesignation(e.target.value)}>
                  <option value="">All designations</option>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Select value={candidateDepartment} onChange={(e) => setCandidateDepartment(e.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Select value={candidateShift} onChange={(e) => setCandidateShift(e.target.value)}>
                  <option value="">Any shift eligibility</option>
                  {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </Select>
                <Select value={candidateStatus} onChange={(e) => setCandidateStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {['ACTIVE','ON_LEAVE','PROBATION','TRAINING','SUSPENDED','RESIGNED','BENCH'].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              {assignmentTab === 'unassigned' && (
                <div className="rounded-md border bg-muted/20 p-3">
                  <Label>Assign Department</Label>
                  <Select className="mt-1.5 max-w-xs" value={targetDepartmentId} onChange={(e) => setTargetDepartmentId(e.target.value)}>
                    <option value="">No department</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </div>
              )}
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10"><input type="checkbox" checked={candidates.length > 0 && selectedIds.length === candidates.length} onChange={toggleAll} /></TableHead><TableHead>Employee</TableHead><TableHead>Designation</TableHead><TableHead>Department</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {candidates.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees found.</TableCell></TableRow>}
                    {candidates.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell><input type="checkbox" checked={selectedIds.includes(employee.id)} onChange={() => toggleSelection(employee.id)} /></TableCell>
                        <TableCell><div className="font-medium">{employee.name}</div><div className="text-xs text-muted-foreground">{employee.employeeCode} - {employee.email}</div></TableCell>
                        <TableCell>{employee.designation?.name}</TableCell>
                        <TableCell>{employee.department?.name ?? <span className="text-muted-foreground">None</span>}</TableCell>
                        <TableCell>{employee.location?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell><Badge variant="outline">{employee.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Close</Button>
              <Button type="button" onClick={applyAssignment} disabled={selectedIds.length === 0}>
                {assignmentTab === 'assigned' ? 'Unassign Selected' : 'Assign Selected'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
