'use client';
import { useEffect, useState } from 'react';
import { Check, Eye, Pencil, Plus, Trash2, FileText, X } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { differenceInCalendarDays, parseISO } from 'date-fns';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EMERGENCY', 'PLANNED', 'MATERNITY', 'PATERNITY', 'UNPAID'];
const statusVariant: Record<string, any> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'outline' };
const leaveDays = (l: any) => differenceInCalendarDays(parseISO(l.endDate), parseISO(l.startDate)) + 1;

export default function MyLeavesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });
  const { toast } = useToast();

  const load = async () => {
    const [mine, approvalRows] = await Promise.all([
      api.get('/leaves/my'),
      api.get('/leaves/approvals?status=PENDING'),
    ]);
    setItems(mine);
    setApprovals(approvalRows);
  };
  useEffect(() => { load(); }, []);

  const dayCount = (() => {
    if (!form.startDate || !form.endDate) return null;
    const diff = differenceInCalendarDays(parseISO(form.endDate), parseISO(form.startDate)) + 1;
    return diff;
  })();

  const resetForm = () => setForm({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });

  const openApply = () => { setEditingId(null); resetForm(); setOpen(true); };
  const openEdit = (l: any) => {
    setEditingId(l.id);
    setForm({ type: l.type, startDate: String(l.startDate).slice(0, 10), endDate: String(l.endDate).slice(0, 10), reason: l.reason ?? '' });
    setOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/leaves/${editingId}`, form);
        toast('Leave updated', 'success');
      } else {
        await api.post('/leaves', form);
        toast('Leave applied', 'success');
      }
      setOpen(false); setEditingId(null); resetForm();
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onCancel = async (id: string) => {
    if (!confirm('Cancel this pending leave?')) return;
    try { await api.del(`/leaves/${id}`); toast('Cancelled', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/leaves/${id}/decision`, { status });
      toast(`Leave ${status.toLowerCase()}`, 'success');
      setViewing((v: any) => (v?.id === id ? null : v));
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Topbar title="My Leaves" subtitle="Apply and track leave requests" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex justify-end">
          <Button onClick={openApply}><Plus className="h-4 w-4 mr-1.5" />Apply for Leave</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? 'Edit Leave Request' : 'Apply for Leave'}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Type</Label>
                  <Select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Start Date</Label><Input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>End Date</Label><Input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
                </div>
                {dayCount !== null && (
                  <p className={`text-xs ${dayCount > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {dayCount > 0 ? `${dayCount} day${dayCount > 1 ? 's' : ''} of leave` : 'End date must be on or after the start date'}
                  </p>
                )}
                <div className="space-y-1.5"><Label>Reason</Label>
                  <textarea className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                    value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Briefly explain the reason…" />
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">{editingId ? 'Save Changes' : 'Submit'}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Applied</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground"><FileText className="inline h-5 w-5 mr-1 opacity-50" />No leaves yet.</TableCell></TableRow>}
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                  <TableCell>{formatDate(l.startDate)}</TableCell>
                  <TableCell>{formatDate(l.endDate)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{l.reason || '—'}</span>
                      {l.reason && (
                        <button
                          type="button"
                          onClick={() => setViewing({ ...l, canDecide: false })}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="View full reason"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant[l.status]}>{l.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {l.status === 'PENDING' && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(l)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => onCancel(l.id)} title="Cancel"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>

        {approvals.length > 0 && (
          <Card><CardContent className="p-0">
            <div className="border-b p-3 text-sm font-medium">Pending Team Approvals</div>
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {approvals.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.employee?.name}</div>
                      <div className="text-xs text-muted-foreground">{l.employee?.employeeCode}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                    <TableCell>{formatDate(l.startDate)}</TableCell>
                    <TableCell>{formatDate(l.endDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{l.reason || '—'}</span>
                        {l.reason && (
                          <button
                            type="button"
                            onClick={() => setViewing({ ...l, canDecide: true })}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            title="View full reason"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => decide(l.id, 'APPROVED')} className="text-emerald-600 hover:text-emerald-700"><Check className="h-4 w-4 mr-1" />Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(l.id, 'REJECTED')} className="text-destructive"><X className="h-4 w-4 mr-1" />Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </main>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.employee?.name ?? 'Leave request'}</DialogTitle>
            {viewing?.employee && (
              <DialogDescription>
                {viewing.employee?.designation?.name} · {viewing.employee?.location?.name}
              </DialogDescription>
            )}
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Type</p><Badge variant="outline">{viewing.type}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={statusVariant[viewing.status]}>{viewing.status}</Badge></div>
              </div>
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {formatDate(viewing.startDate)} – {formatDate(viewing.endDate)}{' '}
                  <span className="text-muted-foreground font-normal">({leaveDays(viewing)} day{leaveDays(viewing) > 1 ? 's' : ''})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm whitespace-pre-wrap">{viewing.reason || 'No reason provided.'}</p>
              </div>
            </div>
          )}
          {viewing?.canDecide && viewing?.status === 'PENDING' && (
            <DialogFooter>
              <Button variant="ghost" className="text-destructive" onClick={() => decide(viewing.id, 'REJECTED')}>
                <X className="h-4 w-4 mr-1" />Reject
              </Button>
              <Button variant="ghost" className="text-emerald-600 hover:text-emerald-700" onClick={() => decide(viewing.id, 'APPROVED')}>
                <Check className="h-4 w-4 mr-1" />Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
