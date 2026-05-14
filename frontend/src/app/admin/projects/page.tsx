'use client';
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, MoreVertical, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { SortDir, filterByQuery, sortRows } from '@/lib/table-tools';

const emptyForm = { name: '', organizationId: '', clientName: '', timezone: 'Asia/Kolkata' };

export default function ProjectsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [assignmentProject, setAssignmentProject] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [assignmentTab, setAssignmentTab] = useState<'assigned' | 'unassigned'>('assigned');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateDesignation, setCandidateDesignation] = useState('');
  const [candidateLocation, setCandidateLocation] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [targetLocationId, setTargetLocationId] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const { toast } = useToast();

  const load = async () => setItems(await api.get('/projects'));
  useEffect(() => {
    (async () => {
      const [projects, organizations, locs, desigs] = await Promise.all([
        api.get('/projects'), api.get('/organizations'), api.get('/locations'), api.get('/designations'),
      ]);
      setItems(projects); setOrgs(organizations); setLocations(locs); setDesignations(desigs);
    })();
  }, []);

  useEffect(() => {
    if (assignmentProject) api.get(`/departments?projectId=${assignmentProject.id}`).then(setDepartments);
    else setDepartments([]);
  }, [assignmentProject]);

  const projectLocations = useMemo(
    () => locations.filter((l) => !assignmentProject || l.projectId === assignmentProject.id),
    [locations, assignmentProject],
  );
  const visibleItems = useMemo(() => {
    const scoped = orgFilter ? items.filter((project) => project.organizationId === orgFilter) : items;
    return sortRows(filterByQuery(scoped, search, ['name', 'code', 'clientName', 'organization.name']), sortKey, sortDir);
  }, [items, orgFilter, search, sortKey, sortDir]);

  const loadCandidates = async () => {
    if (!assignmentProject) return;
    const params = new URLSearchParams();
    params.set('tab', assignmentTab);
    if (candidateSearch) params.set('search', candidateSearch);
    if (candidateDesignation) params.set('designationId', candidateDesignation);
    if (candidateLocation) params.set('locationId', candidateLocation);
    const data = await api.get(`/projects/${assignmentProject.id}/assignment-candidates?${params.toString()}`);
    setCandidates(data);
    setSelectedIds([]);
  };

  useEffect(() => { loadCandidates(); }, [assignmentProject, assignmentTab, candidateSearch, candidateDesignation, candidateLocation]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const openNew = () => {
    const next = { ...emptyForm, organizationId: orgs[0]?.id ?? '' };
    setEditing(null);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const openEdit = (project: any) => {
    const next = {
      name: project.name,
      organizationId: project.organizationId,
      clientName: project.clientName ?? '',
      timezone: project.timezone,
    };
    setEditing(project);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setConfirmOpen(false);
  };

  const requestClose = () => {
    if (dirty) setConfirmOpen(true);
    else closeModal();
  };

  const openAssignments = (project: any) => {
    setAssignmentProject(project);
    setAssignmentTab('assigned');
    setCandidateSearch('');
    setCandidateDesignation('');
    setCandidateLocation('');
    setSelectedIds([]);
    setTargetLocationId('');
    setTargetDepartmentId('');
    setAssignmentOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (!payload.clientName) delete payload.clientName;
      if (editing) {
        delete payload.organizationId;
        await api.put(`/projects/${editing.id}`, payload);
      } else {
        await api.post('/projects', payload);
      }
      toast(editing ? 'Updated' : 'Created', 'success');
      closeModal();
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete project and its locations/departments?')) return;
    try { await api.del(`/projects/${id}`); toast('Deleted', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === candidates.length) setSelectedIds([]);
    else setSelectedIds(candidates.map((employee) => employee.id));
  };

  const applyAssignment = async () => {
    if (!assignmentProject || selectedIds.length === 0) return toast('Select at least one employee', 'error');
    try {
      if (assignmentTab === 'assigned') {
        await api.post(`/projects/${assignmentProject.id}/unassign-employees`, { employeeIds: selectedIds });
        toast(`Unassigned ${selectedIds.length} employee(s)`, 'success');
      } else {
        await api.post(`/projects/${assignmentProject.id}/assign-employees`, {
          employeeIds: selectedIds,
          locationId: targetLocationId || null,
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
      <Topbar title="Projects" subtitle="Operational projects within organizations" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="w-52">
              <option value="">All organizations</option>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </Select>
            <Select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSortKey(key); setSortDir(dir as SortDir); }} className="w-48">
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="code:asc">Code A-Z</option>
              <option value="_count.employees:desc">Employees high-low</option>
              <option value="_count.locations:desc">Locations high-low</option>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Add Project</Button></DialogTrigger>
            <DialogContent
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
                <DialogDescription>Project code is generated automatically, for example PROJ-0001.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                {editing && (
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input value={editing.code} readOnly />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Organization</Label>
                    <Select required disabled={!!editing} value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
                      <option value="">Select organization</option>
                      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Client</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={requestClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Code</TableHead><TableHead>Organization</TableHead><TableHead>Locations</TableHead><TableHead>Employees</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No projects yet.</TableCell></TableRow>}
              {visibleItems.map((project) => (
                <TableRow key={project.id}>
                  <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center"><Briefcase className="h-4 w-4" /></div><div><div className="font-medium">{project.name}</div>{project.clientName && <div className="text-xs text-muted-foreground">{project.clientName}</div>}</div></div></TableCell>
                  <TableCell className="font-mono text-xs">{project.code}</TableCell>
                  <TableCell>{project.organization?.name}</TableCell>
                  <TableCell>{project._count?.locations ?? 0}</TableCell>
                  <TableCell>{project._count?.employees ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openAssignments(project)}><Users className="h-4 w-4 mr-2" />Manage Employees</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(project)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(project.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent
            className="max-w-sm"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                If you go back now, all entered data will be discarded. Are you sure you want to continue?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Continue Editing</Button>
              <Button type="button" variant="destructive" onClick={closeModal}>Discard Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Project Employee Assignments</DialogTitle>
              <DialogDescription>{assignmentProject?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={assignmentTab === 'assigned' ? 'default' : 'outline'} onClick={() => setAssignmentTab('assigned')}>Assigned</Button>
                <Button type="button" variant={assignmentTab === 'unassigned' ? 'default' : 'outline'} onClick={() => setAssignmentTab('unassigned')}>Unassigned</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Input placeholder="Search employees..." value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} />
                <Select value={candidateDesignation} onChange={(e) => setCandidateDesignation(e.target.value)}>
                  <option value="">All designations</option>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Select value={candidateLocation} onChange={(e) => setCandidateLocation(e.target.value)}>
                  <option value="">All locations</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
                <Button type="button" variant="outline" onClick={loadCandidates}>Refresh</Button>
              </div>

              {assignmentTab === 'unassigned' && (
                <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Assign Location</Label>
                    <Select value={targetLocationId} onChange={(e) => setTargetLocationId(e.target.value)}>
                      <option value="">No location</option>
                      {projectLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assign Department</Label>
                    <Select value={targetDepartmentId} onChange={(e) => setTargetDepartmentId(e.target.value)}>
                      <option value="">No department</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                  </div>
                </div>
              )}

              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><input type="checkbox" checked={candidates.length > 0 && selectedIds.length === candidates.length} onChange={toggleAll} /></TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees found.</TableCell></TableRow>}
                    {candidates.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell><input type="checkbox" checked={selectedIds.includes(employee.id)} onChange={() => toggleSelection(employee.id)} /></TableCell>
                        <TableCell>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">{employee.employeeCode} - {employee.email}</div>
                        </TableCell>
                        <TableCell>{employee.designation?.name}</TableCell>
                        <TableCell>{employee.project?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell>{employee.location?.name ?? <span className="text-muted-foreground">None</span>}</TableCell>
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
