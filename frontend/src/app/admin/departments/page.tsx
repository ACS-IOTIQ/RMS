'use client';
import { useEffect, useMemo, useState } from 'react';
import { MoreVertical, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PaginationControls, PaginationMeta } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const emptyForm = { name: '', projectId: '', locationId: '', headEmployeeId: '', capacity: 0 };
const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export default function DepartmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const { toast } = useToast();

  const load = async () => {
    const res = await api.get(`/departments?page=${page}&pageSize=${pageSize}`);
    setItems(res.data ?? []);
    setMeta(res.meta ?? emptyMeta);
  };

  useEffect(() => {
    load();
    Promise.all([api.get('/projects'), api.get('/locations'), api.get('/employees')]).then(([p, l, e]) => {
      setProjects(p);
      setLocations(l);
      setEmployees(Array.isArray(e) ? e : e.data ?? []);
    });
  }, []);
  useEffect(() => { load(); }, [page, pageSize]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const projectLocations = useMemo(() => locations.filter((l) => !form.projectId || l.projectId === form.projectId), [locations, form.projectId]);
  const projectEmployees = useMemo(() => employees.filter((e) => !form.projectId || e.projectId === form.projectId), [employees, form.projectId]);

  const openNew = () => {
    const next = { ...emptyForm, projectId: projects[0]?.id ?? '' };
    setEditing(null);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const openEdit = (dept: any) => {
    const next = {
      name: dept.name,
      projectId: dept.projectId,
      locationId: dept.locationId ?? '',
      headEmployeeId: dept.headEmployeeId ?? '',
      capacity: dept.capacity ?? 0,
    };
    setEditing(dept);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const closeModal = () => { setOpen(false); setConfirmOpen(false); };
  const requestClose = () => dirty ? setConfirmOpen(true) : closeModal();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form, capacity: Number(form.capacity) };
      if (!payload.locationId) payload.locationId = null;
      if (!payload.headEmployeeId) payload.headEmployeeId = null;
      if (editing) {
        delete payload.projectId;
        await api.put(`/departments/${editing.id}`, payload);
      } else {
        await api.post('/departments', payload);
      }
      toast(editing ? 'Updated' : 'Created', 'success');
      closeModal();
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    try {
      await api.del(`/departments/${id}`);
      toast('Deleted', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <Topbar title="Departments" subtitle="Department-to-project and location workforce configuration" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Add Department</Button></DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Department' : 'New Department'}</DialogTitle>
                <DialogDescription>Map departments to a project, optional location, capacity, and department head.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>Project</Label>
                    <Select required disabled={!!editing} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, locationId: '', headEmployeeId: '' })}>
                      <option value="">Select project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Location Mapping</Label>
                    <Select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                      <option value="">No location</option>
                      {projectLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Department Head</Label>
                    <Select value={form.headEmployeeId} onChange={(e) => setForm({ ...form, headEmployeeId: e.target.value })}>
                      <option value="">No head assigned</option>
                      {projectEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={requestClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead>Head</TableHead><TableHead>Capacity</TableHead><TableHead>Employees</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No departments yet.</TableCell></TableRow>}
              {items.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-md bg-cyan-500/10 text-cyan-600 flex items-center justify-center"><Network className="h-4 w-4" /></div><span className="font-medium">{dept.name}</span></div></TableCell>
                  <TableCell>{dept.project?.name}</TableCell>
                  <TableCell>{dept.location?.name ?? <span className="text-muted-foreground">Any location</span>}</TableCell>
                  <TableCell>{dept.headEmployee?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell>{dept.capacity}</TableCell>
                  <TableCell>{dept._count?.employees ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(dept)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(dept.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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
      </main>
    </>
  );
}
