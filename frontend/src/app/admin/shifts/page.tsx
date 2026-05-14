'use client';
import { useEffect, useMemo, useState } from 'react';
import { Clock, MoreVertical, Pencil, Search, Trash2 } from 'lucide-react';
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
import { SortDir, filterByQuery, sortRows } from '@/lib/table-tools';

const shiftCodeClass: Record<string, string> = {
  A: 'bg-sky-100 text-sky-700 border-sky-200',
  B: 'bg-amber-100 text-amber-800 border-amber-200',
  C: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  G: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  F: 'bg-rose-100 text-rose-700 border-rose-200',
};
const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export default function ShiftsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: 'A', name: 'Morning', startTime: '06:00', endTime: '14:00',
    type: 'STANDARD', distribution: 33, priority: 0, locationId: '',
  });
  const [initialForm, setInitialForm] = useState(form);
  const { toast } = useToast();

  const load = async () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (filterProject) params.set('projectId', filterProject);
    if (filterLocation) params.set('locationId', filterLocation);
    const res = await api.get(`/shifts?${params.toString()}`);
    setItems(res.data ?? []);
    setMeta(res.meta ?? emptyMeta);
  };

  useEffect(() => {
    api.get('/locations').then(setLocations);
    api.get('/projects').then(setProjects);
    const locationId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('locationId') : '';
    if (locationId) setFilterLocation(locationId);
  }, []);

  useEffect(() => { load(); }, [filterProject, filterLocation, page, pageSize]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const formLocations = useMemo(() => locations.filter((l) => !filterProject || l.projectId === filterProject), [locations, filterProject]);
  const filterLocations = useMemo(() => locations.filter((l) => !filterProject || l.projectId === filterProject), [locations, filterProject]);
  const visibleItems = useMemo(() => {
    return sortRows(filterByQuery(items, search, ['code', 'name', 'location.name', 'location.project.name']), sortKey, sortDir);
  }, [items, search, sortKey, sortDir]);

  const openNew = () => {
    const next = {
      code: '',
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
      type: 'STANDARD',
      distribution: 33,
      priority: 0,
      locationId: filterLocation || formLocations[0]?.id || locations[0]?.id || '',
    };
    setEditing(null);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const openEdit = (shift: any) => {
    const next = {
      code: shift.code,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      distribution: shift.distribution,
      priority: shift.priority ?? 0,
      locationId: shift.locationId,
    };
    setEditing(shift);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const closeModal = () => { setOpen(false); setConfirmOpen(false); };
  const requestClose = () => dirty ? setConfirmOpen(true) : closeModal();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form, distribution: Number(form.distribution), priority: Number(form.priority) };
      if (editing) {
        delete payload.code; delete payload.locationId;
        await api.put(`/shifts/${editing.id}`, payload);
      } else {
        delete payload.code;
        await api.post('/shifts', payload);
      }
      toast(editing ? 'Updated' : 'Created', 'success');
      closeModal();
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this shift?')) return;
    try { await api.del(`/shifts/${id}`); toast('Deleted', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Topbar title="Shifts" subtitle="Timing and location applicability" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search shifts..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setFilterLocation(''); setPage(1); }} className="w-52">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setPage(1); }} className="w-52">
              <option value="">All locations</option>
              {filterLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
            <Select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSortKey(key); setSortDir(dir as SortDir); }} className="w-48">
              <option value="code:asc">Code A-Z</option>
              <option value="name:asc">Name A-Z</option>
              <option value="location.name:asc">Location A-Z</option>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><Clock className="h-4 w-4 mr-1.5" />Add Shift</Button></DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Shift' : 'New Shift'}</DialogTitle>
                <DialogDescription>Configure shift timing and location applicability.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Code</Label>
                    <Input disabled value={editing ? form.code : 'Auto-generated on save'} />
                  </div>
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Start (HH:mm)</Label><Input required pattern="\d{2}:\d{2}" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>End (HH:mm)</Label><Input required pattern="\d{2}:\d{2}" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Location</Label>
                    <Select required disabled={!!editing} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                      <option value="">Select location</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Timing</TableHead><TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No shifts configured.</TableCell></TableRow>}
              {visibleItems.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell><div className={`h-8 w-8 rounded-md border flex items-center justify-center font-semibold text-xs ${shiftCodeClass[shift.code] ?? 'bg-muted text-muted-foreground border-border'}`}>{shift.code}</div></TableCell>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell className="font-mono text-xs"><Clock className="inline h-3 w-3 mr-1" />{shift.startTime} - {shift.endTime}</TableCell>
                  <TableCell>{shift.location?.project?.name}</TableCell>
                  <TableCell>{shift.location?.name}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(shift)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(shift.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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
            <DialogHeader><DialogTitle>Unsaved Changes</DialogTitle><DialogDescription>If you go back now, all entered data will be discarded. Are you sure you want to continue?</DialogDescription></DialogHeader>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Continue Editing</Button><Button type="button" variant="destructive" onClick={closeModal}>Discard Changes</Button></DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </>
  );
}
