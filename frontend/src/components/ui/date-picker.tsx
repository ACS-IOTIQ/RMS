'use client';
import * as React from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  parseISO, startOfMonth, startOfWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const COL_W = 64; // px per month column in the side wheel
const WHEEL_SPAN = 24; // months rendered on each side of the open month
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface DatePickerProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, className, disabled }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : new Date();
  const [open, setOpen] = React.useState(false);
  // Callback-ref state (not useRef) so the build effect re-fires exactly when these
  // nodes actually exist in the DOM - Radix mounts PopoverContent asynchronously
  // relative to the open-state commit, so a plain useEffect([open]) can run before
  // the nodes are there and silently no-op.
  const [trackEl, setTrackEl] = React.useState<HTMLDivElement | null>(null);
  const [gridEl, setGridEl] = React.useState<HTMLDivElement | null>(null);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cleanupScroll = React.useRef<(() => void) | undefined>(undefined);

  const renderDayGrid = React.useCallback((monthAnchor: Date, grid: HTMLDivElement) => {
    grid.innerHTML = '';
    const monthStart = startOfMonth(monthAnchor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
    for (const day of eachDayOfInterval({ start: gridStart, end: gridEnd })) {
      const selected = isSameDay(day, selectedDate);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.textContent = String(day.getDate());
      cell.className = cn(
        'relative flex h-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors',
        !isSameMonth(day, monthAnchor) && 'text-muted-foreground/50',
        isToday(day) && !selected && "after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-primary after:content-['']",
        selected ? 'bg-primary font-semibold text-primary-foreground shadow-[0_0_0_3px_hsl(var(--ring)/0.22)]' : 'hover:bg-accent',
      );
      cell.addEventListener('click', () => {
        onChange(format(day, 'yyyy-MM-dd'));
        setOpen(false);
      });
      grid.appendChild(cell);
    }
  }, [selectedDate, onChange]);

  const buildWheel = React.useCallback((centerMonth: Date, track: HTMLDivElement, grid: HTMLDivElement) => {
    const scroller = track.parentElement;
    if (!scroller) return;
    cleanupScroll.current?.();
    track.innerHTML = '';
    const cols: HTMLButtonElement[] = [];
    for (let i = -WHEEL_SPAN; i <= WHEEL_SPAN; i++) {
      const monthDate = addMonths(centerMonth, i);
      const col = document.createElement('button');
      col.type = 'button';
      col.textContent = format(monthDate, 'MMM yyyy');
      col.className = cn(
        'relative flex h-full w-16 flex-shrink-0 snap-center items-center justify-center text-[13px] font-semibold tabular-nums transition-colors',
        i === 0 ? 'text-foreground' : 'text-muted-foreground',
        // A quiet dot marks the real current month so it's identifiable while scrolling
        // past it, even when it isn't the month currently centered/being viewed.
        isSameMonth(monthDate, new Date()) && "after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
      );
      const index = i + WHEEL_SPAN;
      col.addEventListener('click', () => scroller.scrollTo({ left: index * COL_W, behavior: 'smooth' }));
      track.appendChild(col);
      cols.push(col);
    }
    scroller.scrollLeft = WHEEL_SPAN * COL_W;

    const centerIndex = () => Math.round(scroller.scrollLeft / COL_W);
    const paintCenter = (idx: number) => cols.forEach((c, ci) => {
      c.classList.toggle('text-foreground', ci === idx);
      c.classList.toggle('text-muted-foreground', ci !== idx);
    });
    const handleScroll = () => {
      paintCenter(centerIndex());
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const idx = centerIndex();
        scroller.scrollTo({ left: idx * COL_W, behavior: 'smooth' });
        renderDayGrid(addMonths(centerMonth, idx - WHEEL_SPAN), grid);
      }, 130);
    };
    scroller.addEventListener('scroll', handleScroll);
    cleanupScroll.current = () => scroller.removeEventListener('scroll', handleScroll);
  }, [renderDayGrid]);

  React.useEffect(() => {
    if (!open || !trackEl || !gridEl) return;
    const anchor = startOfMonth(value ? parseISO(value) : new Date());
    buildWheel(anchor, trackEl, gridEl);
    renderDayGrid(anchor, gridEl);
    return () => cleanupScroll.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trackEl, gridEl]);

  const jumpToday = () => {
    if (!trackEl || !gridEl) return;
    const anchor = startOfMonth(new Date());
    buildWheel(anchor, trackEl, gridEl);
    renderDayGrid(anchor, gridEl);
  };

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors',
            'hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open && 'border-ring ring-2 ring-ring/20',
            className,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="flex-1 truncate text-left tabular-nums">{format(selectedDate, 'EEE, dd MMM yyyy')}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[296px] p-3">
        <div
          className="relative mb-2 h-9 snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            // White = fully visible, black/transparent = masked out - standard mask-image
            // reads gradients by luminance, not alpha, so "black" here would mask out the
            // entire visible zone instead of just the two fade edges.
            WebkitMaskImage: 'linear-gradient(to right, transparent 0, white 32px, white calc(100% - 32px), transparent 100%)',
            maskImage: 'linear-gradient(to right, transparent 0, white 32px, white calc(100% - 32px), transparent 100%)',
          }}
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-16 -translate-x-1/2 -translate-y-1/2 rounded-md bg-accent" />
          <div ref={setTrackEl} className="relative flex h-full" style={{ paddingLeft: COL_W, paddingRight: COL_W }} />
        </div>
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAY_LABELS.map((label, idx) => (
            <span key={idx} className="text-center text-[10.5px] font-bold tracking-wide text-muted-foreground">{label}</span>
          ))}
        </div>
        <div ref={setGridEl} className="grid grid-cols-7 gap-y-0.5" />
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <button type="button" onClick={jumpToday} className="text-xs font-semibold text-primary hover:underline">Today</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
