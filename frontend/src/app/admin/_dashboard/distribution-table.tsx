'use client';

import { type ReactNode, type RefObject, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SortDir, filterByQuery, sortRows } from '@/lib/table-tools';
import { type DesignationGroup, GROUP_COLORS, STATUS_COLORS, labelize, percent } from './shared';

export type DistributionRow = {
  key: string;
  group: DesignationGroup;
  designationId: string;
  designation: string;
  locationId: string | null;
  location: string;
  employeeCount: number;
  percentage: number;
  groupTotal: number;
  locationTotal: number;
  statusCounts: Record<string, number>;
};

const COLUMNS: { key: keyof DistributionRow; label: string; numeric?: boolean }[] = [
  { key: 'group', label: 'Group' },
  { key: 'designation', label: 'Designation' },
  { key: 'location', label: 'Location' },
  { key: 'employeeCount', label: 'Employee Count', numeric: true },
  { key: 'percentage', label: 'Percentage', numeric: true },
  { key: 'groupTotal', label: 'Group Total', numeric: true },
];
const PAGE_SIZES = [5, 10, 20, 50];

/** Detail row that opens and closes by animating its height. */
function DetailRow({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setExpanded(false);
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;
  return (
    <tr>
      <td colSpan={COLUMNS.length} className="bg-[#fafbfd] p-0">
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.7,.3,1)]"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">{children}</div>
        </div>
      </td>
    </tr>
  );
}

function RowDetail({ row, onFilterDesignation, onFilterLocation }: {
  row: DistributionRow;
  onFilterDesignation: (row: DistributionRow) => void;
  onFilterLocation: (row: DistributionRow) => void;
}) {
  const statuses = Object.entries(row.statusCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-[#eef1f5] py-4 pl-10 pr-4">
      <div className="flex flex-col gap-0.5 text-xs text-slate-500">
        <strong className="text-[15px] tabular-nums text-slate-900">{percent(row.employeeCount, row.groupTotal)}%</strong>
        of {row.group}
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-slate-500">
        <strong className="text-[15px] tabular-nums text-slate-900">{percent(row.employeeCount, row.locationTotal)}%</strong>
        of {row.location} headcount
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
        <span className="text-xs text-slate-500">Status mix</span>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {statuses.map(([status, n]) => (
            <span key={status} style={{ flex: n, backgroundColor: STATUS_COLORS[status] ?? '#94a3b8' }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
          {statuses.map(([status, n]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <i className="h-[7px] w-[7px] rounded-sm" style={{ backgroundColor: STATUS_COLORS[status] ?? '#94a3b8' }} />
              {labelize(status)} {n}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onFilterDesignation(row)}
          className="h-[30px] rounded-lg border border-[#e6eaf0] bg-white px-3 text-[12.5px] font-medium hover:bg-[#f2f5f9]"
        >
          Only {row.designation}
        </button>
        {row.locationId && (
          <button
            type="button"
            onClick={() => onFilterLocation(row)}
            className="h-[30px] rounded-lg border border-[#e6eaf0] bg-white px-3 text-[12.5px] font-medium hover:bg-[#f2f5f9]"
          >
            Only {row.location}
          </button>
        )}
      </div>
    </div>
  );
}

export function DistributionTable({
  rows,
  search,
  onSearch,
  searchRef,
  version,
  loading,
  onFilterDesignation,
  onFilterLocation,
}: {
  rows: DistributionRow[];
  search: string;
  onSearch: (value: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  /** Changes when filters change, to reset paging and play the table fade. */
  version: string;
  loading: boolean;
  onFilterDesignation: (row: DistributionRow) => void;
  onFilterLocation: (row: DistributionRow) => void;
}) {
  const [sortKey, setSortKey] = useState<keyof DistributionRow>('employeeCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setOpenKey(null);
  }, [version, search, sortKey, sortDir, pageSize]);

  const sorted = useMemo(
    () => sortRows(filterByQuery(rows, search, ['group', 'designation', 'location']), sortKey, sortDir),
    [rows, search, sortKey, sortDir],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  const maxPct = Math.max(1, ...sorted.map((row) => row.percentage));

  const pageNumbers: (number | '…')[] = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - current) <= 1) pageNumbers.push(p);
    else if (pageNumbers[pageNumbers.length - 1] !== '…') pageNumbers.push('…');
  }

  const sortBy = (key: keyof DistributionRow, numeric?: boolean) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir(numeric ? 'desc' : 'asc');
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search table"
            aria-label="Search table"
            className="h-[38px] w-full rounded-[10px] border border-[#e6eaf0] bg-white pl-8 pr-9 text-[13px] transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[#e6eaf0] bg-[#f2f5f9] px-1.5 text-[11px] text-slate-400 sm:block">/</kbd>
        </div>
        <span className="text-[12.5px] text-slate-500">Click a row for its status mix and quick filters.</span>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-xl border border-[#e6eaf0]">
        <table className="w-full min-w-[660px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className="sticky top-0 z-[1] whitespace-nowrap border-b border-[#e6eaf0] bg-[#f8fafc] p-0 text-xs font-semibold text-slate-500"
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(column.key, column.numeric)}
                      className={cn('flex w-full items-center gap-1.5 px-4 py-[11px] hover:text-slate-900', column.numeric && 'justify-end')}
                    >
                      {column.label}
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 transition-[transform,opacity] duration-200',
                          active ? 'text-primary opacity-100' : 'opacity-35',
                          active && sortDir === 'asc' && 'rotate-180',
                        )}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody key={`${version}|${search}|${sortKey}|${sortDir}|${current}|${pageSize}`} className="wd-fade">
            {slice.map((row) => {
              const open = openKey === row.key;
              return [
                <tr
                  key={row.key}
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : row.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setOpenKey(open ? null : row.key);
                  }}
                  className={cn('cursor-pointer transition-colors hover:bg-[#f8fafc] focus-visible:bg-[#f8fafc] focus-visible:outline-none', open && 'bg-[#f8fafc]')}
                >
                  <td className="whitespace-nowrap border-b border-[#eef1f5] px-4 py-[11px]">
                    <ChevronRight className={cn('mr-2 inline h-3.5 w-3.5 align-[-2px] transition-transform duration-200', open ? 'rotate-90 text-primary' : 'text-slate-400')} />
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: GROUP_COLORS[row.group] }} />
                      {row.group}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-[#eef1f5] px-4 py-[11px]">{row.designation}</td>
                  <td className="whitespace-nowrap border-b border-[#eef1f5] px-4 py-[11px]">{row.location}</td>
                  <td className="border-b border-[#eef1f5] px-4 py-[11px] text-right font-semibold tabular-nums">{row.employeeCount}</td>
                  <td className="border-b border-[#eef1f5] px-4 py-[11px] text-right tabular-nums">
                    <span className="inline-flex items-center gap-2.5">
                      {row.percentage.toFixed(1)}%
                      <span className="h-1 w-14 overflow-hidden rounded-full bg-[#f2f5f9]">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(row.percentage / maxPct) * 100}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-[#eef1f5] px-4 py-[11px] text-right tabular-nums text-slate-500">{row.groupTotal}</td>
                </tr>,
                <DetailRow key={`${row.key}-detail`} open={open}>
                  <RowDetail row={row} onFilterDesignation={onFilterDesignation} onFilterLocation={onFilterLocation} />
                </DetailRow>,
              ];
            })}
            {slice.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                  {loading
                    ? 'Loading dashboard data…'
                    : search
                      ? `No rows match “${search}”. Clear the search or change the filters.`
                      : 'No workforce rows match the selected filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-slate-500">
        <span>{sorted.length ? `Showing ${start + 1}–${start + slice.length} of ${sorted.length} rows` : 'Showing 0 rows'}</span>
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-8 rounded-lg border border-[#e6eaf0] bg-white px-2 text-[12.5px] text-slate-800 focus:border-primary focus:outline-none"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex gap-1">
          <PagerButton disabled={current === 1} onClick={() => setPage(current - 1)} label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </PagerButton>
          {pageNumbers.map((p, i) => (p === '…'
            ? <PagerButton key={`gap-${i}`} disabled>…</PagerButton>
            : <PagerButton key={p} current={p === current} onClick={() => setPage(p)}>{p}</PagerButton>))}
          <PagerButton disabled={current === pages} onClick={() => setPage(current + 1)} label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </PagerButton>
        </div>
      </div>
    </>
  );
}

function PagerButton({ children, current, disabled, onClick, label }: { children: ReactNode; current?: boolean; disabled?: boolean; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[12.5px] transition-colors disabled:cursor-default disabled:opacity-40',
        current ? 'border-primary bg-primary text-white' : 'border-[#e6eaf0] bg-white hover:bg-[#f2f5f9]',
      )}
    >
      {children}
    </button>
  );
}
