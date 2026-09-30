import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { Figtree } from 'next/font/google';
import { cn } from '@/lib/utils';
import styles from './landing.module.css';
import { HEADLINE, PILL, PILL_LABEL, STAGE, STEPS, SUBTITLE, type StageLine } from './steps-layout';

// The reference artwork's typeface.
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap' });

/** Stage px (on the 1440-wide artwork) → container-query width units, so text scales with the image. */
const cq = (px: number) => `${((px / STAGE.width) * 100).toFixed(4)}cqw`;

function Lines({ lines }: { lines: StageLine[] }) {
  return (
    <>
      {lines.map((l) => (
        <span
          key={l.text}
          className={styles.stageLine}
          style={{ left: cq(l.left), top: cq(l.top), fontSize: cq(l.size), letterSpacing: cq(l.tracking), fontWeight: l.weight, color: l.color }}
        >
          {l.text}
        </span>
      ))}
    </>
  );
}

const ICONS: ReactNode[] = [
  // offices
  <svg key="org" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#d8ecff"
      fillRule="evenodd"
      d="M5 3.2c0-.6.5-1.1 1.1-1.1h7.3c.6 0 1.1.5 1.1 1.1V21H5zM7.1 5.3h1.9v2.2H7.1zm3.4 0h1.9v2.2h-1.9zM7.1 9.2h1.9v2.2H7.1zm3.4 0h1.9v2.2h-1.9zM7.1 13.1h1.9v2.2H7.1zm3.4 0h1.9v2.2h-1.9zM8.3 17.4h2.9V21H8.3zM15.5 8.6h3.4c.6 0 1.1.5 1.1 1.1V21h-4.5zm1.3 2.4v1.7h1.9V11zm0 3.4v1.7h1.9v-1.7zm0 3.4v1.7h1.9v-1.7z"
    />
  </svg>,
  // team
  <svg key="team" viewBox="0 0 24 24" fill="#e4f0ff" aria-hidden>
    <circle cx="9" cy="7.4" r="3.8" />
    <path d="M2.3 19.6c0-3.9 3-6.8 6.7-6.8s6.7 2.9 6.7 6.8c0 .6-.4 1-1 1H3.3c-.6 0-1-.4-1-1z" />
    <circle cx="16.6" cy="8.4" r="3" fill="#cfe3ff" />
    <path d="M16.3 13.1c3.1.1 5.4 2.6 5.4 5.8 0 .6-.4 1-1 1h-3.6c.2-.4.3-.8.3-1.3 0-2.3-1-4.4-2.5-5.7.4-.5.9-.8 1.4-.8z" fill="#cfe3ff" />
  </svg>,
  // policy document
  <svg key="policy" viewBox="0 0 24 24" aria-hidden>
    <path fill="#d8ecff" fillRule="evenodd" d="M6.4 2.2h7.7L19.6 7.7v12.6c0 .9-.7 1.6-1.6 1.6H6.4c-.9 0-1.6-.7-1.6-1.6V3.8c0-.9.7-1.6 1.6-1.6zM8 10.6h8v1.7H8zm0 3.4h8v1.7H8zm0 3.4h5v1.7H8z" />
    <path fill="#9cc7ff" d="M14.1 2.2v4.3c0 .7.5 1.2 1.2 1.2h4.3z" />
  </svg>,
  // publish / share
  <svg key="publish" viewBox="0 0 24 24" fill="none" stroke="#e4f0ff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 14.8V3.6" />
    <path d="m7.4 8.1 4.6-4.5 4.6 4.5" />
    <path d="M4 13.6v5.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5.2" />
  </svg>,
];

const join = (lines: StageLine[]) => lines.map((l) => l.text).join(' ');
const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: cq(x), top: cq(y), width: cq(w), height: cq(h) });

export function FourSteps() {
  return (
    <section id="how" className={cn(styles.steps, figtree.className, 'relative overflow-hidden')}>
      {/* Desktop: the reference artwork with live text laid over it exactly. */}
      <div className={cn(styles.stepsStage, 'hidden lg:block')}>
        <Image
          src="/landing/steps-plate.webp"
          alt="Four 3D pedestals showing an office building, a team, a policy checklist with a clock, and a calendar with a green check"
          fill
          unoptimized
          className="select-none object-cover"
          draggable={false}
        />
        <div className={styles.pill} style={box(PILL.left, PILL.top, PILL.width, PILL.height)}>
          <span className={styles.pillDot} style={{ left: cq(PILL.dot) }} />
        </div>
        <div className={styles.stageText}>
          <Lines lines={PILL_LABEL} />
        </div>
        <h2 className={styles.stageText}>
          <Lines lines={HEADLINE} />
        </h2>
        <p className={styles.stageText}>
          <Lines lines={SUBTITLE} />
        </p>
        {STEPS.map((step, i) => (
          <div key={join(step.title)}>
            <span className={styles.stepIcon} style={box(step.icon.x - step.icon.r, step.icon.y - step.icon.r, step.icon.r * 2, step.icon.r * 2)}>
              {ICONS[i]}
            </span>
            <h3 className={styles.stageText}>
              <Lines lines={step.title} />
            </h3>
            <p className={styles.stageText}>
              <Lines lines={step.body} />
            </p>
          </div>
        ))}
      </div>

      {/* Phones and small tablets: same content, stacked. */}
      <div className="px-6 py-16 lg:hidden">
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(37,118,255,0.55)] bg-[rgba(16,58,150,0.45)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[#a6e7ff]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0a8cf8] shadow-[0_0_8px_rgba(10,140,248,0.9)]" />
          How it works
        </span>
        <h2 className="mt-5 text-[34px] font-bold leading-[1.05] tracking-[-0.015em] text-white sm:text-[44px]">
          From setup to a published roster in <span className="text-[#069afe]">four steps.</span>
        </h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#dae6fc]">{join(SUBTITLE)}</p>
        <div className={cn(styles.pedestals, '-mx-6 mt-8')} role="img" aria-label="Four 3D pedestals numbered 01 to 04" />
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={join(step.title)} className={cn(styles.stepCard, 'flex gap-4 rounded-2xl p-5')}>
              <span className={cn(styles.stepIcon, 'h-12 w-12 shrink-0')} style={{ position: 'relative' }}>{ICONS[i]}</span>
              <span>
                <span className="block text-lg font-bold text-white">{join(step.title)}</span>
                <span className="mt-1.5 block text-[15px] leading-relaxed text-[#dde9f7]">{join(step.body)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
