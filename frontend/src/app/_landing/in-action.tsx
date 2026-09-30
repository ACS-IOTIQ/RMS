import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ShieldCheck, Table2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './landing.module.css';

type Shift = 'M' | 'A' | 'N' | 'Off';
const CELL: Record<Shift, string> = { M: styles.cellM, A: styles.cellA, N: styles.cellN, Off: styles.cellOff };

const WEEK: { name: string; shifts: Shift[] }[] = [
  { name: 'Aarav Sharma', shifts: ['M', 'M', 'M', 'M', 'M', 'M', 'Off'] },
  { name: 'Vivaan Reddy', shifts: ['A', 'A', 'Off', 'A', 'A', 'A', 'A'] },
  { name: 'Aditya Kumar', shifts: ['N', 'N', 'N', 'Off', 'N', 'N', 'N'] },
  { name: 'Arjun Verma', shifts: ['M', 'Off', 'M', 'M', 'M', 'M', 'M'] },
  { name: 'Meera Nair', shifts: ['A', 'A', 'A', 'A', 'A', 'Off', 'A'] },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SITES: [number, number][] = [[46, 46], [254, 40], [32, 134], [270, 130], [96, 170], [208, 172]];
const SITE_PATHS = ['M150 100 Q96 64 46 46', 'M150 100 Q204 58 254 40', 'M150 100 Q84 118 32 134', 'M150 100 Q220 116 270 130', 'M150 100 Q112 150 96 170', 'M150 100 Q196 150 208 172'];

const IMPORTED = [
  { id: 'EMP1001', name: 'Aarav Sharma', tag: 'T1 EMS', indigo: false },
  { id: 'EMP1002', name: 'Vivaan Reddy', tag: 'T1 OSS', indigo: false },
  { id: 'EMP1003', name: 'Aditya Kumar', tag: 'T4 SOC', indigo: true },
  { id: 'EMP1004', name: 'Arjun Verma', tag: 'T2 EMS', indigo: false },
];

const AUDIT = [
  ['ROSTER_WEEK_PUBLISH', '10:42', '#a91f3c'],
  ['ROSTER_WEEK_PREVIEW', '10:39', '#5d20e7'],
  ['MULTI_LOCATION_POLICY_APPLY', '10:21', '#c0f412'],
  ['DESIGNATION_REQUIREMENTS_UPDATE', '10:08', '#7b3e90'],
  ['PROJECT_ASSIGN', '09:54', '#e2d451'],
  ['SHIFT_UPDATE', '09:40', '#19ab6f'],
];

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Bento({ className, preview, title, text }: { className?: string; preview: ReactNode; title: string; text: string }) {
  return (
    <div className={cn(styles.bento, 'rounded-[22px] border border-slate-200 bg-white p-5', className)}>
      {preview}
      <div className="px-2 pb-1.5 pt-5">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-[14.5px] leading-[1.6] text-slate-600">{text}</p>
      </div>
    </div>
  );
}

/** Two chips in the same spot that cross-fade, e.g. "Pending" → "Approved". */
function StatusSwap({ width, first, second }: { width: number; first: ReactNode; second: ReactNode }) {
  return (
    <span className="relative h-6 shrink-0" style={{ width }}>
      <span className={cn(styles.fadeA, 'absolute right-0 top-0 whitespace-nowrap')}>{first}</span>
      <span className={cn(styles.fadeB, 'absolute right-0 top-0 whitespace-nowrap')}>{second}</span>
    </span>
  );
}

export function InAction() {
  return (
    <section id="action" className="scroll-mt-6 bg-[#f5f8fd] py-20 lg:py-28">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-blue-600">In action</div>
          <h2 className="mx-auto mt-3 max-w-[760px] text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-slate-900 sm:text-[42px]">
            Watch a week come together.
          </h2>
          <p className="mx-auto mt-4 max-w-[600px] text-[17px] leading-[1.6] text-slate-600">Live previews of the parts your team uses every week.</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Bento
            className="md:col-span-2"
            title="A full week, generated"
            text="Shift groups, weekly offs and cover in one pass, validated before anyone sees it."
            preview={
              <div className={cn(styles.viz, styles.dots, 'relative h-60 overflow-hidden rounded-2xl bg-[#001233] px-5 py-[18px]')}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-100/70">Week of 25 May · 58 employees</span>
                  <StatusSwap
                    width={132}
                    first={<span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-amber-300">Generating…</span>}
                    second={<span className="rounded-full bg-green-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-green-300">Ready to publish</span>}
                  />
                </div>
                <div className="mt-3.5 flex flex-col gap-1.5 overflow-x-auto">
                  <div className="grid min-w-[440px] grid-cols-[110px_repeat(7,minmax(0,1fr))] gap-[5px] text-center text-[10.5px] font-semibold text-blue-200/50">
                    <span />
                    {DAYS.map((d) => <span key={d}>{d}</span>)}
                  </div>
                  {WEEK.map(({ name, shifts }, r) => (
                    <div key={name} className="grid min-w-[440px] grid-cols-[110px_repeat(7,minmax(0,1fr))] items-center gap-[5px]">
                      <span className="truncate text-xs text-white/80">{name}</span>
                      {shifts.map((s, c) => (
                        <span key={c} className={cn(styles.cell, CELL[s])} style={delay((r * 7 + c) * 0.05)}>{s}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            }
          />

          <Bento
            title="Policy in, targets out"
            text="Headcount and shift split turn into exact daily targets per shift."
            preview={
              <div className={cn(styles.viz, 'flex h-60 flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-[18px]')}>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Daily headcount</div>
                    <div className="mt-0.5 text-[32px] font-bold tracking-[-0.02em] text-slate-900">
                      49<span className="text-[13px] font-medium text-slate-500"> / day</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11.5px] font-semibold text-blue-700">6 days · 1 off</span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700">Shift split</div>
                  <div className="mt-2 flex h-3.5 gap-[3px]">
                    <span className={cn(styles.grow, 'w-[40%] rounded-l-full rounded-r-[3px] bg-blue-500')} style={delay(0)} />
                    <span className={cn(styles.grow, 'w-[40%] rounded-[3px] bg-amber-500')} style={delay(0.25)} />
                    <span className={cn(styles.grow, 'w-[20%] rounded-l-[3px] rounded-r-full bg-indigo-500')} style={delay(0.5)} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[['Morning', '20', 'text-blue-700'], ['Afternoon', '20', 'text-amber-700'], ['Night', '9', 'text-indigo-700']].map(([label, n, tone]) => (
                      <div key={label} className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-2">
                        <div className="text-[11px] text-slate-500">{label}</div>
                        <div className={cn('text-[15px] font-bold', tone)}>{n}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            }
          />

          <Bento
            title="Coverage across sites"
            text="Scarce designations spread so every shift is covered somewhere in the project."
            preview={
              <div className={cn(styles.viz, styles.dots, 'relative h-60 overflow-hidden rounded-2xl bg-[#001233]')}>
                <span className="absolute left-4 top-3.5 text-xs text-blue-100/70">Project coverage · 24/7</span>
                <svg viewBox="0 0 300 200" className="absolute left-0 top-6 h-[200px] w-full" aria-hidden>
                  {SITE_PATHS.map((d) => <path key={d} className={styles.flowLine} d={d} />)}
                  {SITES.map(([x, y], k) => (
                    <g key={k}>
                      <circle className={styles.ring} cx={x} cy={y} r="5" fill="#60a5fa" style={delay(k * 0.4)} />
                      <circle cx={x} cy={y} r="5" fill="#bfdbfe" />
                    </g>
                  ))}
                  <circle className={styles.ring} cx="150" cy="100" r="8" fill="#3b82f6" />
                  <circle cx="150" cy="100" r="8" fill="#ffffff" stroke="#3b82f6" strokeWidth="3" />
                </svg>
                <span className="absolute bottom-3 right-3.5 rounded-full bg-blue-500/20 px-2.5 py-1 text-[11px] font-semibold text-blue-200">Every shift covered</span>
              </div>
            }
          />

          <Bento
            title="Leave that finds cover"
            text="Approved leave updates availability, and gaps come with suggested cover."
            preview={
              <div className={cn(styles.viz, 'flex h-60 flex-col justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-[18px]')}>
                <div className="rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.3)]">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">MN</span>
                    <span className="min-w-0 flex-grow">
                      <span className="block text-[13.5px] font-semibold text-slate-900">Meera Nair</span>
                      <span className="block text-xs text-slate-500">Casual leave · 2 days</span>
                    </span>
                    <StatusSwap
                      width={78}
                      first={<span className="rounded-full bg-amber-100 px-[9px] py-[3px] text-[11px] font-semibold text-amber-700">Pending</span>}
                      second={<span className="rounded-full bg-green-100 px-[9px] py-[3px] text-[11px] font-semibold text-green-700">Approved</span>}
                    />
                  </div>
                </div>
                <div className={cn(styles.slideIn, 'flex items-center gap-2.5 rounded-[14px] border border-dashed border-blue-300 bg-blue-50 px-3.5 py-3 text-[12.5px] font-semibold text-blue-700')}>
                  <UserPlus className="h-4 w-4 shrink-0" />
                  Cover found: backup T3 SOC for both days
                </div>
              </div>
            }
          />

          <Bento
            title="Import from Excel"
            text="Upload your workforce in one file; new designations are picked up automatically."
            preview={
              <div className={cn(styles.viz, 'flex h-60 flex-col gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 p-4')}>
                <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
                  <Table2 className="h-[18px] w-[18px] text-green-700" />
                  <span className="flex-grow text-[12.5px] font-semibold text-green-800">employees.xlsx</span>
                  <ArrowDown className={cn(styles.bounce, 'h-4 w-4 text-green-700')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {IMPORTED.map(({ id, name, tag, indigo }, k) => (
                    <div
                      key={id}
                      className={cn(styles.rowIn, 'grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-2.5 py-2 text-xs')}
                      style={delay(k * 0.35)}
                    >
                      <span className="font-mono text-slate-500">{id}</span>
                      <span className="truncate font-semibold text-slate-900">{name}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', indigo ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700')}>{tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            }
          />

          <div className={cn(styles.bento, 'grid items-center gap-7 rounded-[22px] border border-slate-200 bg-white p-5 md:col-span-2 lg:col-span-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]')}>
            <div className="py-2 pl-3 pr-2">
              <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] border border-blue-100 bg-blue-50 text-blue-600">
                <ShieldCheck className="h-[22px] w-[22px]" />
              </div>
              <h3 className="mt-[18px] text-[22px] font-bold tracking-[-0.01em] text-slate-900">Every change on the record</h3>
              <p className="mt-2.5 max-w-[380px] text-[15px] leading-[1.6] text-slate-600">Every change lands in a tamper-evident audit trail, each entry chained to the last.</p>
            </div>
            <div className={cn(styles.viz, styles.fadeEdges, styles.dots, 'relative h-[196px] overflow-hidden rounded-2xl bg-[#001233]')}>
              <div className={cn(styles.ticker, 'flex flex-col gap-2 px-4 py-3.5')}>
                {[...AUDIT, ...AUDIT].map(([action, time, hash], k) => (
                  <div key={k} className="grid grid-cols-[minmax(0,1fr)_52px_64px] items-center gap-2.5 rounded-[10px] bg-white/5 px-3 py-[9px] text-xs sm:grid-cols-[minmax(0,1fr)_150px_52px_64px]">
                    <span className="truncate font-mono font-semibold text-indigo-100">{action}</span>
                    <span className="hidden text-blue-100/60 sm:inline">admin@roster.com</span>
                    <span className="text-blue-100/50">{time}</span>
                    <span className="font-mono text-cyan-300">{hash}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
