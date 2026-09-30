'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  LayoutDashboard,
  MapPin,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './landing.module.css';

const MODULES = [
  { icon: SlidersHorizontal, from: '#2563eb', to: '#60a5fa', glow: '37,99,235', title: 'Policy-driven scheduling', text: 'Rosters built from your headcount, shift split and designation rules.' },
  { icon: CalendarCheck, from: '#4f46e5', to: '#818cf8', glow: '79,70,229', title: 'Weekly roster engine', text: 'Preview, validate and publish a full week in one pass.' },
  { icon: MapPin, from: '#0d9488', to: '#2dd4bf', glow: '13,148,136', title: 'Multi-location coverage', text: 'Keep every shift covered across sites and projects.' },
  { icon: Users, from: '#7c3aed', to: '#a78bfa', glow: '124,58,237', title: 'Leave management', text: 'Simple approvals that update availability straight away.' },
  { icon: Scale, from: '#0891b2', to: '#22d3ee', glow: '8,145,178', title: 'Fairness scoring', text: 'Nights, weekends and repeat shifts rotated evenly.' },
  { icon: BarChart3, from: '#1d4ed8', to: '#38bdf8', glow: '29,78,216', title: 'Analytics and insights', text: 'Staffing, leave and roster trends at a glance.' },
  { icon: Table2, from: '#059669', to: '#34d399', glow: '5,150,105', title: 'Excel import and export', text: 'Bulk upload employees and download rosters as Excel.' },
  { icon: LayoutDashboard, from: '#d97706', to: '#fbbf24', glow: '217,119,6', title: 'Role-based portals', text: 'Admins run operations; employees see rosters and apply for leave.' },
  { icon: ShieldCheck, from: '#e11d48', to: '#fb7185', glow: '225,29,72', title: 'Audit and compliance', text: 'Every change recorded in a tamper-evident audit trail.' },
] as const;

const COUNT = MODULES.length;
const START = 1;
/** Cards per second while gliding: one card reaches the front every 3.5 s. */
const SPEED = 1 / 3.5;

// Pose of a card at 0–4 slots from the front (mirrored for the left side); in-between offsets are interpolated.
// Side cards stay (nearly) opaque and only gently turned, so their text stays sharp and readable;
// the outermost ones fade out.
const POSES = [
  { x: 0, z: 90, ry: 0, s: 1.06, o: 1 },
  { x: 262, z: -10, ry: 16, s: 0.95, o: 1 },
  { x: 502, z: -80, ry: 24, s: 0.88, o: 0.92 },
  { x: 712, z: -150, ry: 32, s: 0.8, o: 0.55 },
  { x: 880, z: -220, ry: 38, s: 0.72, o: 0 },
];

const wrap = (d: number) => ((((d + COUNT / 2) % COUNT) + COUNT) % COUNT) - COUNT / 2;

/** Transform, opacity and stacking for a card `d` slots from the front (negative = left). */
function pose(d: number): CSSProperties {
  const a = Math.min(Math.abs(d), POSES.length - 1);
  const i = Math.min(Math.floor(a), POSES.length - 2);
  const k = a - i;
  const lerp = (key: keyof (typeof POSES)[number]) => POSES[i][key] + (POSES[i + 1][key] - POSES[i][key]) * k;
  const side = d < 0 ? -1 : 1;
  const opacity = lerp('o');
  return {
    // Whole-pixel offsets keep glyph edges from shimmering between pixels while the cards glide.
    transform: `translateX(${Math.round(side * lerp('x'))}px) translateZ(${Math.round(lerp('z'))}px) rotateY(${(-side * lerp('ry')).toFixed(2)}deg) scale(${lerp('s').toFixed(4)})`,
    opacity,
    zIndex: 10 - Math.round(a * 2),
    pointerEvents: opacity < 0.05 ? 'none' : undefined,
  };
}

/** Index of the card nearest the front for a given glide position. */
const frontOf = (phase: number) => ((Math.round(phase) % COUNT) + COUNT) % COUNT;

export function ModuleCarousel() {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const phase = useRef(START);
  const nudge = useRef(0);
  const hovering = useRef(false);
  const [front, setFront] = useState(START);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    let speed = SPEED;
    let visible = true;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      // Ease to a stop while a card is under the pointer (settling fully, no creep), and back up to speed afterwards.
      const target = hovering.current ? 0 : SPEED;
      speed += (target - speed) * Math.min(1, dt * 8);
      if (target === 0 && speed < SPEED * 0.01) speed = 0;
      const push = nudge.current * Math.min(1, dt * 6);
      nudge.current -= push;
      phase.current += speed * dt + push;

      cards.current.forEach((el, i) => {
        if (!el) return;
        const p = pose(wrap(i - phase.current));
        el.style.transform = p.transform as string;
        el.style.opacity = String(p.opacity);
        el.style.zIndex = String(p.zIndex);
        el.style.pointerEvents = p.pointerEvents ?? '';
      });
      setFront(frontOf(phase.current));
      if (visible) frame = requestAnimationFrame(tick);
    };

    // Only animate while the carousel is on screen.
    const host = cards.current[0]?.parentElement;
    const io = host
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !frame) {
            last = 0;
            frame = requestAnimationFrame(tick);
          }
          if (!visible) {
            cancelAnimationFrame(frame);
            frame = 0;
          }
        })
      : null;
    if (io && host) io.observe(host);
    else frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
    };
  }, []);

  /** Glide to card `i` the shortest way round (dots). */
  const goTo = (i: number) => {
    const at = Math.round(phase.current + nudge.current);
    nudge.current = at + Math.round(wrap(i - at)) - phase.current;
  };

  // Mouse: pause while the cursor is on a card. Touch: pause while a finger is held on one.
  const pause = () => {
    hovering.current = true;
  };
  const resume = () => {
    hovering.current = false;
  };
  const onEnter = (e: PointerEvent) => e.pointerType === 'mouse' && pause();
  const onUp = (e: PointerEvent) => e.pointerType !== 'mouse' && resume();

  return (
    <div id="modules" className="relative z-20 scroll-mt-24">
      <div className={styles.stage} aria-roledescription="carousel" aria-label="RosterOps modules">
        {MODULES.map(({ icon: Icon, from, to, glow, title, text }, i) => (
          <div
            key={title}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className={cn(styles.card, i === front && styles.front)}
            style={pose(wrap(i - START))}
            aria-hidden={i !== front}
            onPointerEnter={onEnter}
            onPointerLeave={resume}
            onPointerDown={pause}
            onPointerUp={onUp}
            onPointerCancel={resume}
          >
            <div
              className={styles.cardIcon}
              style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 10px 24px -8px rgba(${glow},0.8)` }}
            >
              <Icon className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="mt-5 text-[17px] font-bold leading-[1.25]">{title}</div>
            <div className="mt-2 text-[13.5px] leading-[1.55] text-blue-100/70">{text}</div>
            <span className={styles.cardGo}>
              <ArrowUpRight className="h-[15px] w-[15px]" strokeWidth={2} />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex justify-center gap-2">
        {MODULES.map(({ title }, i) => (
          <button
            key={title}
            type="button"
            className={cn(styles.dot, i === front && styles.dotOn)}
            onClick={() => goTo(i)}
            aria-label={`Show ${title}`}
            aria-current={i === front}
          />
        ))}
      </div>
    </div>
  );
}
