'use client';
import { useEffect, useMemo, useState } from 'react';
import { Award, MoreVertical, Pencil, Search, Trash2 } from 'lucide-react';
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

const emptyForm = { name: '', level: 1, isCritical: false };
const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export default function DesignationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [criticalFilter, setCriticalFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const { toast } = useToast();

  const load = async () => {
    const res = await api.get(`/designations?page=${page}&pageSize=${pageSize}`);
    setItems(res.data ?? []);
    setMeta(res.meta ?? emptyMeta);
  };

  useEffect(() => { load(); }, [page, pageSize]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const visibleItems = useMemo(() => {
    const scoped = criticalFilter ? items.filter((item) => String(item.isCritical) === criticalFilter) : items;
    return sortRows(filterByQuery(scoped, search, ['name']), sortKey, sortDir);
  }, [items, criticalFilter, search, sortKey, sortDir]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (designation: any) => {
    const next = {
      name: designation.name,
      level: designation.level,
      isCritical: designation.isCritical,
    };
    setEditing(designation);
    setForm(next);
    setInitialForm(next);
    setOpen(true);
  };

  const closeModal = () => { setOpen(false); setConfirmOpen(false); };
  const requestClose = () => dirty ? setConfirmOpen(true) : closeModal();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, level: Number(form.level) };
      if (editing) await api.put(`/designations/${editing.id}`, payload);
      else await api.post('/designations', payload);
      toast(editing ? 'Updated' : 'Created', 'success');
      closeModal();
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this designation?')) return;
    try { await api.del(`/designations/${id}`); toast('Deleted', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Topbar title="Designations" subtitle="Critical role tagging" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search designations..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={criticalFilter} onChange={(e) => setCriticalFilter(e.target.value)} className="w-44">
              <option value="">All criticality</option>
              <option value="true">Critical</option>
              <option value="false">Non-critical</option>
            </Select>
            <Select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSortKey(key); setSortDir(dir as SortDir); }} className="w-48">
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="_count.employees:desc">Employees high-low</option>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><Award className="h-4 w-4 mr-1.5" />Add Designation</Button></DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Designation' : 'New Designation'}</DialogTitle>
                <DialogDescription>Configure designation name and critical tagging.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isCritical} onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} className="h-4 w-4 rounded border" />
                  Critical designation
                </label>
                <DialogFooter><Button type="button" variant="outline" onClick={requestClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Designation</TableHead><TableHead>Critical</TableHead><TableHead>Employees</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No designations yet.</TableCell></TableRow>}
              {visibleItems.map((designation) => (
                <TableRow key={designation.id}>
                  <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center"><Award className="h-4 w-4" /></div><span className="font-medium">{designation.name}</span></div></TableCell>
                  <TableCell>{designation.isCritical ? <Badge variant="warning">Critical</Badge> : <span className="text-muted-foreground">No</span>}</TableCell>
                  <TableCell>{designation._count?.employees ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(designation)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(designation.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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
