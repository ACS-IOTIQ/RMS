'use client';
import { useEffect, useState } from 'react';
import { Check, FileText, Search, X } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { SortDir, filterByQuery, sortRows } from '@/lib/table-tools';

const statusVariant: Record<string, any> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'outline' };

export default function LeavesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { toast } = useToast();

  const load = async () => {
    const q = filter ? `?status=${filter}` : '';
    setItems(await api.get(`/leaves${q}`));
  };
  useEffect(() => { load(); }, [filter]);

  const visibleItems = sortRows(
    filterByQuery(
      typeFilter ? items.filter((item) => item.type === typeFilter) : items,
      search,
      ['employee.name', 'employee.email', 'employee.employeeCode', 'reason', 'approver.name'],
    ),
    sortKey,
    sortDir,
  );

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
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search employee, reason, RM..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-xs">
            <option value="">All types</option>
            {['CASUAL', 'SICK', 'EMERGENCY', 'PLANNED', 'MATERNITY', 'PATERNITY', 'UNPAID'].map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
          <Select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSortKey(key); setSortDir(dir as SortDir); }} className="max-w-xs">
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="employee.name:asc">Employee A-Z</option>
            <option value="startDate:asc">Start date A-Z</option>
            <option value="status:asc">Status A-Z</option>
          </Select>
        </div>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>RM</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground"><FileText className="inline h-5 w-5 mr-1 opacity-50" />No leave requests.</TableCell></TableRow>}
              {visibleItems.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.employee?.name}</div>
                    <div className="text-xs text-muted-foreground">{l.employee?.designation?.name} · {l.employee?.location?.name}</div>
                  </TableCell>
                  <TableCell>{l.approver?.name ?? l.employee?.reportingManager?.name ?? <span className="text-muted-foreground">None</span>}</TableCell>
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
