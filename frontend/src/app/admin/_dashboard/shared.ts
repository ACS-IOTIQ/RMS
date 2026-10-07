'use client';

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type DesignationGroup = 'SOC' | 'NOC' | 'Infra' | 'Application' | 'Non-IT';

// One blue family plus a neutral, darkest first, so the charts read as a single system.
export const GROUPS: { name: DesignationGroup; color: string }[] = [
  { name: 'SOC', color: '#1e3a8a' },
  { name: 'NOC', color: '#2563eb' },
  { name: 'Infra', color: '#60a5fa' },
  { name: 'Application', color: '#a3c2f2' },
  { name: 'Non-IT', color: '#94a3b8' },
];
export const GROUP_COLORS = Object.fromEntries(GROUPS.map((group) => [group.name, group.color])) as Record<DesignationGroup, string>;

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#15803d',
  ON_LEAVE: '#b45309',
  TRAINING: '#64748b',
  PROBATION: '#475569',
  BENCH: '#94a3b8',
  SUSPENDED: '#b91c1c',
  RESIGNED: '#cbd5e1',
};

export const EASE = 'cubic-bezier(.2, .7, .3, 1)';
// Overshoots slightly, so bars rise past their value and settle back.
export const RISE = 'cubic-bezier(.34, 1.3, .64, 1)';
export const RISE_MS = 700;
export const STAGGER_MS = 70;
export const SWEEP_MS = 1000;

/** Changes whenever charts should replay their entrance (data loaded, refresh, expanded view). Falsy means "nothing to show yet". */
export type Replay = number | string;

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function percent(count: number, total: number) {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

export function labelize(value: string) {
  if (!value) return 'All';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveDesignationGroup(name?: string): DesignationGroup {
  const text = String(name ?? '').toUpperCase();
  if (/\bSOC\b/.test(text)) return 'SOC';
  if (text.includes('NON-IT') || text.includes('NON IT')) return 'Non-IT';
  if (/\bOSS\b/.test(text) || /\bNOC\b/.test(text)) return 'NOC';
  if (/\bEMS\b/.test(text) || text.includes('APPLICATION') || /\bAPP\b/.test(text)) return 'Application';
  if (
    text.includes('INFRA') ||
    text.includes('SERVER') ||
    text.includes('STORAGE') ||
    text.includes('BACKUP') ||
    text.includes('NETWORK') ||
    text.includes('VIRTUAL') ||
    text.includes('CLOUD') ||
    text.includes('DR/BCP') ||
    /\bDR\b/.test(text)
  ) {
    return 'Infra';
  }
  return 'Application';
}

/** Whole-number axis with at most `tickCount` steps above zero. */
export function niceScale(value: number, tickCount = 4) {
  if (value <= 0) return { max: tickCount, ticks: Array.from({ length: tickCount + 1 }, (_, i) => i) };
  const rough = value / tickCount;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow);
  const max = Math.ceil(value / step) * step;
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) };
}

export const SHARE_SCALE = { max: 100, ticks: [0, 25, 50, 75, 100] };

/**
 * Animated number. When `replay` changes it counts up from zero (after `delay`);
 * any other change of `value` glides from the number currently shown.
 */
export function useCountUp(value: number, replay: Replay = 0, { duration = 450, delay = 0 } = {}) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  const seen = useRef<Replay | undefined>(undefined);

  useIsoLayoutEffect(() => {
    const replaying = seen.current !== replay;
    seen.current = replay;
    const from = replaying ? 0 : current.current;
    if (reducedMotion() || from === value) {
      current.current = value;
      setDisplay(value);
      return;
    }
    const d = replaying ? duration : 450;
    const t0 = performance.now() + (replaying ? delay : 0);
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / d));
      const next = Math.round(from + (value - from) * (1 - (1 - p) ** 3));
      current.current = next;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setDisplay(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, replay]);

  return display;
}

export type RisePhase = 'idle' | 'zero' | 'rise';

/** Drives a "rise from zero" entrance: zero (no transition) → rise (staggered transition) → idle. */
export function useRisePhase(replay: Replay, settleMs: number): RisePhase {
  const [phase, setPhase] = useState<RisePhase>('idle');
  useIsoLayoutEffect(() => {
    if (!replay || reducedMotion()) {
      setPhase('idle');
      return;
    }
    setPhase('zero');
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('rise'));
    });
    const done = setTimeout(() => setPhase('idle'), settleMs + 80);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(done);
    };
  }, [replay]);
  return phase;
}

export function riseStyle(phase: RisePhase, heightPct: number, delay: number) {
  if (phase === 'zero') return { height: '0%', transition: 'none' };
  if (phase === 'rise') return { height: `${heightPct}%`, transition: `height ${RISE_MS}ms ${RISE} ${delay}ms` };
  return { height: `${heightPct}%`, transition: `height 450ms ${RISE}` };
}

/**
 * FLIP-animates children marked `data-flip="<id>"` whenever `key` changes
 * (cards reordered, hidden or shown), so the grid glides into its new layout.
 * While `enabled` is false it only records positions (e.g. while restoring a saved layout on load).
 */
export function useFlipGrid(ref: RefObject<HTMLElement>, key: string, enabled = true) {
  const rects = useRef(new Map<string, { x: number; y: number }>());

  const measure = () => {
    const next = new Map<string, { x: number; y: number }>();
    ref.current?.querySelectorAll<HTMLElement>('[data-flip]').forEach((item) => {
      next.set(item.dataset.flip!, { x: item.offsetLeft, y: item.offsetTop });
    });
    return next;
  };

  useIsoLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const next = measure();
    if (enabled && rects.current.size && !reducedMotion()) {
      container.querySelectorAll<HTMLElement>('[data-flip]').forEach((item) => {
        const before = rects.current.get(item.dataset.flip!);
        const after = next.get(item.dataset.flip!)!;
        if (!before) {
          item.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
          return;
        }
        const dx = before.x - after.x;
        const dy = before.y - after.y;
        if (dx || dy) item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 350, easing: EASE });
      });
    }
    rects.current = next;
  }, [key]);

  // Content changes (data loading, filters) move cards too; keep the baseline current.
  useEffect(() => {
    const container = ref.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      rects.current = measure();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
}
