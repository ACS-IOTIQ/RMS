import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function PaginationControls({
  meta,
  onPageChange,
  onPageSizeChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const end = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <div className="flex flex-col gap-3 border-t p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Showing {start}-{end} of {meta.total}
      </div>
      <div className="flex items-center gap-2">
        <Select
          className="h-8 w-24"
          value={String(meta.pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-24 text-center text-muted-foreground">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
