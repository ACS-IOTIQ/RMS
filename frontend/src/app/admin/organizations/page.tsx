'use client';
import { useEffect, useState } from 'react';
import { Building2, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PaginationControls, PaginationMeta } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { SortDir, filterByQuery, sortRows } from '@/lib/table-tools';

const emptyForm = { name: '' };
const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export default function OrganizationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const { toast } = useToast();

  const load = async () => {
    const res = await api.get(`/organizations?page=${page}&pageSize=${pageSize}`);
    setItems(res.data ?? []);
    setMeta(res.meta ?? emptyMeta);
  };

  useEffect(() => { load(); }, [page, pageSize]);
  const visibleItems = sortRows(filterByQuery(items, search, ['name', 'code']), sortKey, sortDir);

  const dirty = form.name !== initialForm.name;

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (org: any) => {
    const next = { name: org.name };
    setEditing(org);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/organizations/${editing.id}`, form);
      else await api.post('/organizations', form);
      toast(editing ? 'Updated' : 'Created', 'success');
      closeModal();
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete organization and all its projects?')) return;
    try { await api.del(`/organizations/${id}`); toast('Deleted', 'success'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Topbar title="Organizations" subtitle="Top-level business entities" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSortKey(key); setSortDir(dir as SortDir); }} className="w-48">
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="code:asc">Code A-Z</option>
              <option value="_count.projects:desc">Projects high-low</option>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Add Organization</Button></DialogTrigger>
            <DialogContent
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Organization' : 'New Organization'}</DialogTitle>
                <DialogDescription>Organization code is generated automatically, for example ORG-0001.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                {editing && (
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input value={editing.code} readOnly />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={requestClose}>Cancel</Button>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Code</TableHead><TableHead>Projects</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No organizations yet.</TableCell></TableRow>}
              {visibleItems.map((org) => (
                <TableRow key={org.id}>
                  <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Building2 className="h-4 w-4" /></div><span className="font-medium">{org.name}</span></div></TableCell>
                  <TableCell className="font-mono text-xs">{org.code}</TableCell>
                  <TableCell>{org._count?.projects ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(org)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(org.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            meta={meta}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
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
      </main>
    </>
  );
}
