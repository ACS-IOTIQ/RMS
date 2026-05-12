'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EMERGENCY', 'PLANNED', 'MATERNITY', 'PATERNITY', 'UNPAID'];
const statusVariant: Record<string, any> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'outline' };

export default function MyLeavesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });
  const { toast } = useToast();

  const load = async () => setItems(await api.get('/leaves/my'));
  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/leaves', form);
      toast('Leave applied', 'success'); setOpen(false);
      setForm({ type: 'CASUAL', startDate: '', endDate: '', reason: '' });
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const onCancel = async (id: string) => {
    if (!confirm('Cancel this pending leave?')) return;
    try { await api.del(`/leaves/${id}`); toast('Cancelled', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Topbar title="My Leaves" subtitle="Apply and track leave requests" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" />Apply for Leave</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
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
                <div className="space-y-1.5"><Label>Reason</Label>
                  <textarea className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                    value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Briefly explain the reason…" />
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Submit</Button></DialogFooter>
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
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.reason || '—'}</TableCell>
                  <TableCell><Badge variant={statusVariant[l.status]}>{l.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {l.status === 'PENDING' && <Button size="icon" variant="ghost" onClick={() => onCancel(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </main>
    </>
  );
}
