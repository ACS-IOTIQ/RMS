'use client';

import { type ReactNode, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutoHeight, GrowFill, tipHandlers, useTip } from './bento';
import {
  type DesignationGroup,
  type Replay,
  type RisePhase,
  EASE,
  GROUPS,
  RISE_MS,
  SHARE_SCALE,
  STAGGER_MS,
  SWEEP_MS,
  niceScale,
  percent,
  reducedMotion,
  riseStyle,
  useCountUp,
  useIsoLayoutEffect,
  useRisePhase,
} from './shared';

export type GroupDatum = { group: DesignationGroup; count: number; percentage: number; color: string };
export type LocationDatum = { id: string; location: string; total: number } & Partial<Record<DesignationGroup, number>>;
export type DrillDatum = { id: string; designation: string; count: number; percentage: number };

function TipBody({ title, line, hint }: { title: ReactNode; line: ReactNode; hint?: ReactNode }) {
  return (
    <>
      <b className="font-semibold">{title}</b> · {line}
      {hint && <small className="mt-0.5 block text-[#a9b8d0]">{hint}</small>}
    </>
  );
}

/* ---------- Donut ---------- */

const R = 76;
const CIRC = 2 * Math.PI * R;
const GAP = 2.5;

/** Donut that sweeps clockwise from 12 o'clock on each replay, slice after slice. */
export function DonutChart({
  data,
  total,
  replay,
  delay = 0,
  focus,
  onSelect,
  size = 196,
}: {
  data: GroupDatum[];
  total: number;
  replay: Replay;
  delay?: number;
  focus: DesignationGroup;
  onSelect: (group: DesignationGroup) => void;
  size?: number;
}) {
  const tip = useTip();
  const [drawn, setDrawn] = useState<number | null>(null);
  const [hover, setHover] = useState<DesignationGroup | null>(null);
  const counted = useCountUp(total, replay, { duration: SWEEP_MS, delay });

  useIsoLayoutEffect(() => {
    if (!replay || reducedMotion()) {
      setDrawn(null);
      return;
    }
    setDrawn(0);
    const t0 = performance.now() + delay;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / SWEEP_MS));
      if (p >= 1) {
        setDrawn(null);
        return;
      }
      setDrawn((1 - (1 - p) ** 3) * CIRC);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [replay]);

  let acc = 0;
  const arcs = data.map((d) => {
    const len = total ? (d.count / total) * CIRC : 0;
    const arc = { ...d, start: acc, len, mid: (acc + len / 2) / R };
    acc += len;
    return arc;
  });
  const hovered = hover ? data.find((d) => d.group === hover) : null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90 overflow-visible">
          <circle cx={100} cy={100} r={R} fill="none" stroke="#f2f5f9" strokeWidth={24} />
          {arcs.map((arc) => {
            const shown = drawn === null ? arc.len : Math.min(arc.len, Math.max(0, drawn - arc.start));
            const dash = shown ? Math.max(0, shown - (GAP * shown) / arc.len) : 0;
            const on = hover === arc.group;
            return (
              <circle
                key={arc.group}
                cx={100}
                cy={100}
                r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={24}
                strokeDasharray={`${dash} ${CIRC}`}
                strokeDashoffset={-arc.start}
                className="cursor-pointer"
                style={{
                  transition: drawn === null
                    ? `stroke-dasharray .4s ${EASE}, stroke-dashoffset .4s ${EASE}, opacity .2s, transform .2s ${EASE}`
                    : 'none',
                  opacity: hover && !on ? 0.35 : 1,
                  transform: on ? `translate(${Math.cos(arc.mid) * 5}px, ${Math.sin(arc.mid) * 5}px)` : undefined,
                }}
                onMouseEnter={(event) => {
                  setHover(arc.group);
                  tip.show(event, <TipBody title={arc.group} line={`${arc.count} employees`} hint={`${arc.percentage}% of workforce · click to drill down`} />);
                }}
                onMouseMove={tip.move}
                onMouseLeave={() => {
                  setHover(null);
                  tip.hide();
                }}
                onClick={() => onSelect(arc.group)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <strong className="text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums text-slate-900">
            {(hovered ? hovered.count : counted).toLocaleString()}
          </strong>
          <span className="mt-1.5 text-xs text-slate-500">{hovered ? `${hovered.group} · ${hovered.percentage}%` : 'Employees'}</span>
        </div>
      </div>

      <div key={String(replay)} className="flex w-full flex-col gap-0.5">
        {arcs.map((arc) => (
          <button
            key={arc.group}
            type="button"
            onClick={() => onSelect(arc.group)}
            onMouseEnter={() => setHover(arc.group)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              'wd-face grid grid-cols-[10px_1fr_auto_auto] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[#f2f5f9]',
              focus === arc.group && 'bg-[#f2f5f9]',
            )}
            style={{ animationDelay: replay ? `${delay + Math.round((arc.start / CIRC) * SWEEP_MS * 0.8)}ms` : undefined }}
          >
            <i className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: arc.color }} />
            <span className="text-slate-800">{arc.group}</span>
            <span className="font-semibold tabular-nums text-slate-900">{arc.count}</span>
            <span className="w-12 text-right tabular-nums text-slate-500">{arc.percentage}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Shared bar-chart frame ---------- */

/** y-axis and plot share one grid row, so a bar's height maps 1:1 onto the axis; x labels hang below. */
function ChartFrame({ scale, suffix = '', height, children }: { scale: { max: number; ticks: number[] }; suffix?: string; height: number; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_30px] gap-x-2 pt-6" style={{ height }}>
      <div className="relative text-[11px] tabular-nums text-slate-400">
        {scale.ticks.map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / scale.max) * 100}%` }}>
            {t}{suffix}
          </span>
        ))}
      </div>
      <div className="relative border-b border-[#e6eaf0]">
        {scale.ticks.slice(1).map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-[#e6eaf0]" style={{ bottom: `${(t / scale.max) * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end justify-around gap-2.5 px-1">{children}</div>
      </div>
    </div>
  );
}

function RiseColumn({
  label,
  value,
  heightPct,
  phase,
  delay,
  replay,
  onClick,
  tip,
  children,
}: {
  label: string;
  value: number;
  heightPct: number;
  phase: RisePhase;
  delay: number;
  replay: Replay;
  onClick?: () => void;
  tip?: () => ReactNode;
  children: ReactNode;
}) {
  const tipApi = useTip();
  const shown = useCountUp(value, replay, { duration: RISE_MS, delay });
  return (
    <div
      className={cn('group relative flex h-full max-w-12 flex-1 flex-col justify-end', onClick && 'cursor-pointer')}
      onClick={onClick}
      {...(tip ? tipHandlers(tipApi, tip) : {})}
    >
      <div className="relative w-full" style={riseStyle(phase, heightPct, delay)}>
        <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-900">
          {shown.toLocaleString()}
        </span>
        {children}
      </div>
      <span className="absolute left-1/2 top-[calc(100%+9px)] max-w-[calc(100%+10px)] -translate-x-1/2 truncate whitespace-nowrap text-[11.5px] text-slate-500" title={label}>
        {label}
      </span>
    </div>
  );
}

/* ---------- Group bars ---------- */

export function GroupBarChart({
  data,
  total,
  focus,
  replay,
  delay = 0,
  onSelect,
  height = 300,
}: {
  data: GroupDatum[];
  total: number;
  focus: DesignationGroup;
  replay: Replay;
  delay?: number;
  onSelect: (group: DesignationGroup) => void;
  height?: number;
}) {
  const phase = useRisePhase(replay, delay + data.length * STAGGER_MS + RISE_MS);
  const scale = niceScale(Math.max(0, ...data.map((d) => d.count)));
  return (
    <ChartFrame scale={scale} height={height}>
      {data.map((d, i) => (
        <RiseColumn
          key={d.group}
          label={d.group}
          value={d.count}
          heightPct={(d.count / scale.max) * 100}
          phase={phase}
          delay={delay + i * STAGGER_MS}
          replay={replay}
          onClick={() => onSelect(d.group)}
          tip={() => <TipBody title={d.group} line={`${d.count} employees`} hint={`${percent(d.count, total)}% of workforce · click to drill down`} />}
        >
          <div
            className="h-full w-full rounded-t-md rounded-b-sm bg-primary transition-[background-color,opacity] duration-200 group-hover:bg-blue-700"
            style={{ opacity: focus === d.group ? 1 : 0.5 }}
          />
        </RiseColumn>
      ))}
    </ChartFrame>
  );
}

/* ---------- Location stacks ---------- */

export function LocationStackChart({
  rows,
  mode,
  replay,
  delay = 0,
  onSegment,
  height = 262,
}: {
  rows: LocationDatum[];
  mode: 'count' | 'share';
  replay: Replay;
  delay?: number;
  onSegment: (row: LocationDatum, group: DesignationGroup) => void;
  height?: number;
}) {
  const tip = useTip();
  // A different set of locations re-runs the rise for the new columns.
  const key = `${replay}|${rows.map((row) => row.id).join(',')}`;
  const effectiveReplay = replay ? key : 0;
  const phase = useRisePhase(effectiveReplay, delay + rows.length * STAGGER_MS + RISE_MS);
  const scale = mode === 'count' ? niceScale(Math.max(0, ...rows.map((row) => row.total))) : SHARE_SCALE;

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center text-[13px] text-slate-500" style={{ height }}>
        No employees match these filters.
      </div>
    );
  }

  return (
    <>
      <ChartFrame scale={scale} suffix={mode === 'share' ? '%' : ''} height={height}>
        {rows.map((row, ci) => {
          const top = GROUPS.reduce((last, group, i) => ((row[group.name] ?? 0) > 0 ? i : last), -1);
          return (
            <RiseColumn
              key={row.id}
              label={row.location}
              value={row.total}
              heightPct={mode === 'count' ? (row.total / scale.max) * 100 : 100}
              phase={phase}
              delay={delay + ci * STAGGER_MS}
              replay={effectiveReplay}
            >
              <div className="flex h-full w-full flex-col-reverse overflow-hidden rounded-t-md rounded-b-sm [&:hover>span]:opacity-60">
                {GROUPS.map((group, i) => {
                  const count = row[group.name] ?? 0;
                  const clickable = count > 0 && row.id !== 'unassigned';
                  return (
                    <span
                      key={group.name}
                      className={cn('block shrink-0 border-white transition-[height,opacity] duration-[450ms] hover:!opacity-100', clickable && 'cursor-pointer')}
                      style={{
                        height: `${row.total ? (count / row.total) * 100 : 0}%`,
                        backgroundColor: group.color,
                        borderTopWidth: count > 0 && i !== top ? 2 : 0,
                        transitionTimingFunction: EASE,
                      }}
                      onMouseEnter={(event) => {
                        if (!count) return;
                        tip.show(event, (
                          <TipBody
                            title={`${row.location} · ${group.name}`}
                            line={`${count} (${percent(count, row.total)}% of ${row.location})`}
                            hint={clickable ? `Click to filter to ${group.name} in ${row.location}` : undefined}
                          />
                        ));
                      }}
                      onMouseMove={tip.move}
                      onMouseLeave={tip.hide}
                      onClick={() => {
                        if (!clickable) return;
                        tip.hide();
                        onSegment(row, group.name);
                      }}
                    />
                  );
                })}
              </div>
            </RiseColumn>
          );
        })}
      </ChartFrame>
      <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-slate-500">
        {GROUPS.map((group) => (
          <span key={group.name} className="inline-flex items-center gap-1.5">
            <i className="h-[9px] w-[9px] rounded-[3px]" style={{ backgroundColor: group.color }} />
            {group.name}
          </span>
        ))}
      </div>
    </>
  );
}

/* ---------- Drill-down ---------- */

function DrillRow({ row, index, max, onPick }: { row: DrillDatum; index: number; max: number; onPick: () => void }) {
  const shown = useCountUp(row.count, 1, { duration: 500, delay: index * 50 });
  return (
    <button
      type="button"
      onClick={onPick}
      className="wd-face group -mx-1.5 grid grid-cols-[minmax(96px,150px)_minmax(0,1fr)_36px_14px] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[#f2f5f9]"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <span className="truncate text-slate-800" title={row.designation}>{row.designation}</span>
      <div className="h-3 overflow-hidden rounded-md bg-[#f2f5f9] transition-colors group-hover:bg-[#e9eef5]">
        <GrowFill pct={(row.count / max) * 100} delay={index * 50} className="h-full rounded-md bg-primary" />
      </div>
      <span className="text-right font-semibold tabular-nums text-slate-900">{shown}</span>
      <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-primary opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
    </button>
  );
}

export function DrillDown({
  rows,
  focus,
  lockedGroup,
  replay,
  onFocus,
  onPick,
  limit = 10,
}: {
  rows: DrillDatum[];
  focus: DesignationGroup;
  lockedGroup: string;
  replay: Replay;
  onFocus: (group: DesignationGroup) => void;
  onPick: (row: DrillDatum) => void;
  limit?: number;
}) {
  const visible = rows.slice(0, limit);
  const max = Math.max(1, ...visible.map((row) => row.count));
  return (
    <>
      <div className="mb-3.5 flex flex-wrap gap-1.5" role="group" aria-label="Group">
        {GROUPS.map((group) => (
          <button
            key={group.name}
            type="button"
            aria-pressed={focus === group.name}
            disabled={!!lockedGroup && lockedGroup !== group.name}
            onClick={() => onFocus(group.name)}
            className={cn(
              'h-7 rounded-full border px-3 text-[12.5px] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
              focus === group.name
                ? 'border-transparent bg-[#eef3fe] font-semibold text-primary'
                : 'border-[#e6eaf0] bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900',
            )}
          >
            {group.name}
          </button>
        ))}
      </div>
      <AutoHeight>
        <div key={`${focus}|${replay}`} className="flex flex-col gap-1">
          {visible.map((row, i) => (
            <DrillRow key={row.id} row={row} index={i} max={max} onPick={() => onPick(row)} />
          ))}
          {visible.length === 0 && <p className="py-2 text-[12.5px] text-slate-500">No employees in {focus} for the current filters. Try another group or clear the filters.</p>}
          {rows.length > limit && <p className="pt-1 text-xs text-slate-500">+{rows.length - limit} more designations in the table below.</p>}
        </div>
      </AutoHeight>
    </>
  );
}

/* ---------- Group summary ---------- */

function SummaryBlock({
  datum,
  index,
  maxCount,
  topDesignation,
  selected,
  replay,
  onSelect,
}: {
  datum: GroupDatum;
  index: number;
  maxCount: number;
  topDesignation?: string;
  selected: boolean;
  replay: Replay;
  onSelect: () => void;
}) {
  const shown = useCountUp(datum.count, replay, { duration: 700, delay: index * 60 });
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px',
        selected ? 'border-primary bg-[#eef3fe]' : 'border-[#e6eaf0] bg-white hover:border-slate-300',
      )}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
        <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: datum.color }} />
        {datum.group}
      </span>
      <span className="text-2xl font-bold tracking-[-0.02em] tabular-nums text-slate-900">{shown.toLocaleString()}</span>
      <span className="text-xs tabular-nums text-slate-500">{datum.percentage}% of workforce</span>
      <div className={cn('mt-1 h-1 overflow-hidden rounded-full', selected ? 'bg-[#dfe8fb]' : 'bg-[#f2f5f9]')}>
        <GrowFill key={String(replay)} pct={(datum.count / maxCount) * 100} delay={index * 60} className="h-full rounded-full bg-primary" />
      </div>
      <span className="mt-1.5 truncate border-t border-[#e6eaf0] pt-2 text-[11.5px] text-slate-500">
        {topDesignation ? <>Top: <b className="font-medium text-slate-800">{topDesignation}</b></> : 'No employees'}
      </span>
    </button>
  );
}

export function GroupSummaryBlocks({
  data,
  focus,
  topDesignations,
  replay,
  onSelect,
}: {
  data: GroupDatum[];
  focus: DesignationGroup;
  topDesignations: Partial<Record<DesignationGroup, string>>;
  replay: Replay;
  onSelect: (group: DesignationGroup) => void;
}) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {data.map((datum, i) => (
        <SummaryBlock
          key={datum.group}
          datum={datum}
          index={i}
          maxCount={maxCount}
          topDesignation={topDesignations[datum.group]}
          selected={focus === datum.group}
          replay={replay}
          onSelect={() => onSelect(datum.group)}
        />
      ))}
    </div>
  );
}
