'use client';
import { useEffect, useState } from 'react';
import { Award, MoreVertical, Pencil, Settings2, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const emptyForm = { name: '', level: 1, isCritical: false, minStaffing: 1 };
const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export default function DesignationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [eligibilityEditing, setEligibilityEditing] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [eligibilityCounts, setEligibilityCounts] = useState<Record<string, number>>({});
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
      minStaffing: designation.minStaffing,
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
      const payload = { ...form, level: Number(form.level), minStaffing: Number(form.minStaffing) };
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

  const openEligibility = async (designation: any) => {
    setEligibilityEditing(designation);
    const data = await api.get('/shifts');
    setShifts(data);
    const counts: Record<string, number> = {};
    for (const shift of data) {
      const req = shift.requirements?.find((r: any) => r.designationId === designation.id);
      counts[shift.id] = req?.minCount ?? 0;
    }
    setEligibilityCounts(counts);
    setEligibilityOpen(true);
  };

  const saveEligibility = async () => {
    try {
      await Promise.all(shifts.map((shift) => {
        const others = (shift.requirements ?? [])
          .filter((r: any) => r.designationId !== eligibilityEditing.id)
          .map((r: any) => ({ designationId: r.designationId, minCount: r.minCount }));
        const minCount = Number(eligibilityCounts[shift.id] ?? 0);
        const items = minCount > 0 ? [...others, { designationId: eligibilityEditing.id, minCount }] : others;
        return api.put(`/shifts/${shift.id}/requirements`, { items });
      }));
      toast('Shift eligibility saved', 'success');
      setEligibilityOpen(false);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <Topbar title="Designations" subtitle="Hierarchy, critical roles, staffing, and shift eligibility" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}>
            <DialogTrigger asChild><Button onClick={openNew}><Award className="h-4 w-4 mr-1.5" />Add Designation</Button></DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Designation' : 'New Designation'}</DialogTitle>
                <DialogDescription>Configure hierarchy level, critical tagging, and minimum staffing.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Hierarchy Level</Label><Input type="number" min={1} max={10} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Min Staffing</Label><Input type="number" min={0} value={form.minStaffing} onChange={(e) => setForm({ ...form, minStaffing: Number(e.target.value) })} /></div>
                </div>
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
            <TableHeader><TableRow><TableHead>Designation</TableHead><TableHead>Level</TableHead><TableHead>Critical</TableHead><TableHead>Min Staffing</TableHead><TableHead>Shift Eligibility</TableHead><TableHead>Employees</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No designations yet.</TableCell></TableRow>}
              {items.map((designation) => (
                <TableRow key={designation.id}>
                  <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center"><Award className="h-4 w-4" /></div><span className="font-medium">{designation.name}</span></div></TableCell>
                  <TableCell><Badge variant="outline">L{designation.level}</Badge></TableCell>
                  <TableCell>{designation.isCritical ? <Badge variant="warning">Critical</Badge> : <span className="text-muted-foreground">No</span>}</TableCell>
                  <TableCell>{designation.minStaffing}</TableCell>
                  <TableCell>{designation.shiftRequirements?.length ?? 0} shift(s)</TableCell>
                  <TableCell>{designation._count?.employees ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(designation)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEligibility(designation)}><Settings2 className="h-4 w-4 mr-2" />Shift Eligibility</DropdownMenuItem>
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

        <Dialog open={eligibilityOpen} onOpenChange={setEligibilityOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Shift Eligibility</DialogTitle>
              <DialogDescription>{eligibilityEditing?.name}. Set minimum staffing per shift; zero means not eligible.</DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-auto space-y-2">
              {shifts.map((shift) => (
                <div key={shift.id} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{shift.code} - {shift.name}</div>
                    <div className="text-xs text-muted-foreground">{shift.location?.name} / {shift.location?.project?.name}</div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    value={eligibilityCounts[shift.id] ?? 0}
                    onChange={(e) => setEligibilityCounts({ ...eligibilityCounts, [shift.id]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEligibilityOpen(false)}>Cancel</Button><Button type="button" onClick={saveEligibility}>Save Eligibility</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
