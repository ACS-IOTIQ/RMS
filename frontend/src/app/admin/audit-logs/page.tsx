'use client';
import { useEffect, useMemo, useState } from 'react';
import { FileSearch, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationControls, PaginationMeta } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const emptyMeta: PaginationMeta = { page: 1, pageSize: 25, total: 0, totalPages: 1 };

export default function AuditLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [integrity, setIntegrity] = useState<any>(null);
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set('q', q);
    if (entityType) params.set('entityType', entityType);
    const res = await api.get(`/audit-logs?${params.toString()}`);
    setItems(res.data ?? []);
    setMeta(res.meta ?? emptyMeta);
    setIntegrity(res.integrity);
  };

  useEffect(() => { load(); }, [q, entityType, page, pageSize]);

  const entityTypes = useMemo(() => Array.from(new Set(items.map((item) => item.entityType).filter(Boolean))).sort(), [items]);

  return (
    <>
      <Topbar title="Audit Logs" subtitle="Admin-only action history with basic hash-chain integrity" />
      <main className="p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search action, route, actor, entity..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="lg:w-56">
              <option value="">All entity types</option>
              {entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Badge variant={integrity?.valid ? 'success' : 'destructive'} className="justify-center">
              {integrity?.valid ? <ShieldCheck className="mr-1 h-3 w-3" /> : <ShieldAlert className="mr-1 h-3 w-3" />}
              {integrity?.valid ? `Verified ${integrity.checked ?? 0}` : 'Integrity issue'}
            </Badge>
          </CardContent>
        </Card>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Actor</TableHead><TableHead>Route</TableHead><TableHead>Hash</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground"><FileSearch className="mr-1 inline h-5 w-5 opacity-50" />No audit logs found.</TableCell></TableRow>}
              {items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                  <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                  <TableCell>
                    <div className="font-medium">{log.entityType}</div>
                    <div className="max-w-48 truncate font-mono text-xs text-muted-foreground">{log.entityId}</div>
                  </TableCell>
                  <TableCell>
                    <div>{log.actorEmail ?? 'System'}</div>
                    <div className="text-xs text-muted-foreground">{log.actorRole ?? '-'}</div>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground">{log.method} {log.route}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs">{log.hash ?? 'legacy'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={meta} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </CardContent></Card>
      </main>
    </>
  );
}
