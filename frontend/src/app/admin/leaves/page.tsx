'use client';
import { useEffect, useState } from 'react';
import { Check, X, FileText } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

const statusVariant: Record<string, any> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'outline' };

export default function LeavesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const { toast } = useToast();

  const load = async () => {
    const q = filter ? `?status=${filter}` : '';
    setItems(await api.get(`/leaves${q}`));
  };
  useEffect(() => { load(); }, [filter]);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/leaves/${id}/decision`, { status });
      toast(`Leave ${status.toLowerCase()}`, 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Topbar title="Leaves" subtitle="Review and decide on leave requests" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground"><FileText className="inline h-5 w-5 mr-1 opacity-50" />No leave requests.</TableCell></TableRow>}
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.employee?.name}</div>
                    <div className="text-xs text-muted-foreground">{l.employee?.designation?.name} · {l.employee?.location?.name}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                  <TableCell>{formatDate(l.startDate)}</TableCell>
                  <TableCell>{formatDate(l.endDate)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.reason || '—'}</TableCell>
                  <TableCell><Badge variant={statusVariant[l.status]}>{l.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {l.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => decide(l.id, 'APPROVED')} className="text-emerald-600 hover:text-emerald-700"><Check className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => decide(l.id, 'REJECTED')} className="text-destructive"><X className="h-4 w-4 mr-1" />Reject</Button>
                      </>
                    )}
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
