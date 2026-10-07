'use client';

import {
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Inter } from 'next/font/google';
import { type LucideIcon, ArrowUpRight, BarChart3, CheckCircle2, EyeOff, Maximize2, MoreHorizontal, Table2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type Replay, useCountUp, useIsoLayoutEffect } from './shared';

export const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const CARD_CLASS =
  'relative flex h-full min-w-0 flex-col rounded-2xl border border-[#e6eaf0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ' +
  'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(.2,.7,.3,1)]';
const LIFT_CLASS = 'hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,27,45,0.08)]';

/* ---------- Chart tooltip ---------- */

type TipApi = {
  show: (event: ReactMouseEvent, content: ReactNode) => void;
  move: (event: ReactMouseEvent) => void;
  hide: () => void;
};
const TipContext = createContext<TipApi | null>(null);

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });

  const place = useCallback((x: number, y: number) => {
    pos.current = { x, y };
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = x + 14;
    let top = y - h - 12;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 18;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, []);

  const api = useMemo<TipApi>(() => ({
    show: (event, next) => {
      setContent(next);
      setVisible(true);
      place(event.clientX, event.clientY);
    },
    move: (event) => place(event.clientX, event.clientY),
    hide: () => setVisible(false),
  }), [place]);

  // Re-place once the new content has rendered and has its real size.
  useIsoLayoutEffect(() => {
    if (visible) place(pos.current.x, pos.current.y);
  }, [content, visible]);

  return (
    <TipContext.Provider value={api}>
      {children}
      <div
        ref={ref}
        role="tooltip"
        className={cn(
          'pointer-events-none fixed left-0 top-0 z-[90] max-w-[240px] rounded-lg bg-[#0f1b2d] px-2.5 py-2 text-xs leading-snug text-white shadow-[0_8px_24px_rgba(15,27,45,0.2)]',
          'transition-[opacity,transform] duration-150',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        {content}
      </div>
    </TipContext.Provider>
  );
}

export function useTip() {
  const api = useContext(TipContext);
  if (!api) throw new Error('useTip must be inside TooltipProvider');
  return api;
}

export function tipHandlers(tip: TipApi, content: () => ReactNode) {
  return {
    onMouseEnter: (event: ReactMouseEvent) => tip.show(event, content()),
    onMouseMove: tip.move,
    onMouseLeave: tip.hide,
  };
}

/* ---------- Toasts with undo ---------- */

type DashToast = { id: number; message: string; undo?: () => void; leaving?: boolean };

export function useDashboardToasts() {
  const [items, setItems] = useState<DashToast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 200);
  }, []);

  const push = useCallback((message: string, undo?: () => void) => {
    const id = ++nextId.current;
    setItems((list) => [...list.slice(-2), { id, message, undo }]);
    setTimeout(() => dismiss(id), undo ? 5000 : 3000);
  }, [dismiss]);

  return { items, push, dismiss };
}

export function ToastStack({ items, dismiss }: { items: DashToast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[95] flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            'pointer-events-auto flex max-w-full items-center gap-2.5 rounded-xl bg-[#0f1b2d] py-2.5 pl-3.5 pr-3 text-[13px] text-white shadow-[0_12px_32px_rgba(15,27,45,0.25)]',
            item.leaving ? 'wd-toast-out' : 'wd-toast-in',
          )}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{item.message}</span>
          {item.undo && (
            <button
              type="button"
              onClick={() => {
                item.undo?.();
                dismiss(item.id);
              }}
              className="rounded-md bg-white/10 px-2.5 py-1 text-[12.5px] font-semibold text-blue-200 hover:bg-white/20"
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Card menu ---------- */

type MenuItem = { label: string; icon: LucideIcon; onSelect: () => void };

function CardMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Card options"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#f2f5f9] hover:text-slate-900',
          open && 'bg-[#f2f5f9] text-slate-900',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="wd-pop absolute right-0 top-[calc(100%+6px)] z-30 min-w-[176px] origin-top-right rounded-xl border border-[#e6eaf0] bg-white p-1 shadow-[0_12px_32px_rgba(15,27,45,0.12)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-800 hover:bg-[#f2f5f9]"
            >
              <item.icon className="h-[15px] w-[15px] text-slate-500" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Bento card ---------- */

/**
 * Card shell with a ⋯ menu: Expand (opens a larger view that replays the chart),
 * Show data (swaps the chart for its numbers) and Hide card.
 * `children` receives the replay key to use: the page's, or a fresh one in the expanded view.
 */
export function BentoCard({
  title,
  subtitle,
  tools,
  dataView,
  onHide,
  loading,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  tools?: ReactNode;
  dataView?: ReactNode;
  onHide: () => void;
  loading?: boolean;
  children: (expanded: Replay | null) => ReactNode;
}) {
  const [showData, setShowData] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandCount, setExpandCount] = useState(0);

  const items: MenuItem[] = [
    { label: 'Expand', icon: Maximize2, onSelect: () => { setExpandCount((n) => n + 1); setExpanded(true); } },
    ...(dataView ? [{ label: showData ? 'Show chart' : 'Show data', icon: showData ? BarChart3 : Table2, onSelect: () => setShowData((v) => !v) }] : []),
    { label: 'Hide card', icon: EyeOff, onSelect: onHide },
  ];

  return (
    <div className={cn(CARD_CLASS, LIFT_CLASS, loading && 'wd-loading')}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {tools}
          <CardMenu items={items} />
        </div>
      </header>
      <div key={showData ? 'data' : 'chart'} className="wd-face min-h-0 flex-1">
        {showData && dataView ? dataView : children(null)}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className={cn(inter.className, 'max-h-[calc(100vh-48px)] max-w-5xl overflow-y-auto rounded-2xl')}>
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>
          {expanded && (showData && dataView ? dataView : children(`expanded-${expandCount}`))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- KPI card ---------- */

export function KpiCard({
  icon: Icon,
  label,
  value,
  help,
  hint,
  onAction,
  primary,
  active,
  replay,
  delay = 0,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  help: ReactNode;
  hint: string;
  onAction: () => void;
  primary?: boolean;
  active?: boolean;
  replay: Replay;
  delay?: number;
  loading?: boolean;
}) {
  const shown = useCountUp(value, replay, { duration: 700, delay });
  const [delta, setDelta] = useState<{ diff: number; visible: boolean }>({ diff: 0, visible: false });
  const previous = useRef<{ value: number; replay: Replay } | null>(null);

  // Briefly show how much a filter change moved the number (not on load or refresh).
  useEffect(() => {
    const prev = previous.current;
    previous.current = { value, replay };
    if (!prev || prev.replay !== replay || prev.value === value || loading) return;
    setDelta({ diff: value - prev.value, visible: true });
    const timer = setTimeout(() => setDelta((d) => ({ ...d, visible: false })), 2600);
    return () => clearTimeout(timer);
  }, [value, replay, loading]);

  return (
    <div
      role="button"
      tabIndex={0}
      title={hint}
      onClick={onAction}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAction();
        }
      }}
      className={cn(
        CARD_CLASS,
        LIFT_CLASS,
        'group cursor-pointer gap-1 p-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        active && 'border-primary bg-[#fbfcff]',
        loading && 'wd-loading',
      )}
    >
      {active ? (
        <span className="absolute right-3.5 top-4 rounded-full bg-[#eef3fe] px-2 py-0.5 text-[11px] font-semibold text-primary">Filtered</span>
      ) : (
        <ArrowUpRight className="absolute right-4 top-[18px] h-4 w-4 -translate-x-1 translate-y-1 text-primary opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}
      <div className="mb-2.5 flex items-center gap-2.5 pr-6">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors',
            primary || active ? 'bg-[#eef3fe] text-primary' : 'bg-[#f2f5f9] text-slate-500 group-hover:bg-[#eef3fe] group-hover:text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
      </div>
      <div className={cn('flex items-baseline gap-2 text-[28px] font-bold leading-tight tracking-[-0.02em] tabular-nums', primary ? 'text-primary' : 'text-slate-900')}>
        {shown.toLocaleString()}
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold tracking-normal transition-[opacity,transform] duration-300',
            delta.diff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f2f5f9] text-slate-500',
            delta.visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
          )}
          aria-hidden={!delta.visible}
        >
          {delta.diff > 0 ? '▲' : '▼'} {Math.abs(delta.diff).toLocaleString()}
        </span>
      </div>
      <div className="flex min-h-5 items-center gap-1.5 text-xs text-slate-500">
        <span className="group-hover:hidden">{help}</span>
        <span className="wd-face hidden font-medium text-primary group-hover:inline">{hint}</span>
      </div>
    </div>
  );
}

/* ---------- Small pieces ---------- */

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[340px] overflow-auto rounded-xl border border-[#e6eaf0]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={cell} className={cn('sticky top-0 border-b border-[#e6eaf0] bg-[#f8fafc] px-3 py-2.5 text-xs font-semibold text-slate-500', i ? 'text-right' : 'text-left')}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b border-[#eef1f5] last:border-0">
              {row.map((cell, i) => (
                <td key={i} className={cn('px-3 py-2.5', i ? 'text-right tabular-nums' : 'text-left')}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-slate-500">No data for these filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Animates its height to fit whatever it contains. */
export function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    setHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(.2,.7,.3,1)]" style={{ height }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

/** A bar that grows from zero when it mounts, then follows `pct`. */
export function GrowFill({ pct, delay = 0, className, color }: { pct: number; delay?: number; className?: string; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setWidth(pct));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [pct]);
  return (
    <div
      className={className}
      style={{
        width: `${width}%`,
        backgroundColor: color,
        transition: `width 600ms cubic-bezier(.34, 1.2, .64, 1) ${delay}ms`,
      }}
    />
  );
}
