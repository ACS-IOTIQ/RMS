'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { FourSteps } from './_landing/four-steps';
import { HeroRibbons } from './_landing/hero-ribbons';
import { InAction } from './_landing/in-action';
import { ModuleCarousel } from './_landing/module-carousel';
import styles from './_landing/landing.module.css';

const NAV = [
  { href: '#modules', label: 'Modules' },
  { href: '#action', label: 'In action' },
  { href: '#how', label: 'How it works' },
];

export default function HomePage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  /** Fade the landing page out before leaving it, so the jump to sign-in feels intentional. */
  const leaveTo = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isExiting) return;
    setIsExiting(true);
    window.setTimeout(() => router.push(href), 320);
  };

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-white text-slate-900"
      style={{
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(0.985)' : undefined,
        transition: 'opacity 420ms ease-out, transform 420ms ease-out',
      }}
    >
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#030f2c] pb-16 text-white lg:min-h-[960px]">
        <HeroRibbons />

        <nav className="relative z-30 border-b border-white/[0.07]">
          <div className="mx-auto flex h-[76px] max-w-[1200px] items-center justify-between gap-4 px-6 xl:px-0">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={38} />
              <span className="text-lg font-bold tracking-[-0.01em] text-white">RosterOps</span>
            </Link>
            <div className="hidden gap-9 text-sm font-medium md:flex">
              {NAV.map(({ href, label }) => (
                <a key={href} href={href} className={styles.navLink}>
                  {label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                onClick={leaveTo('/login')}
                className={cn(styles.btnGlass, 'inline-flex h-[42px] items-center rounded-full border border-white/20 bg-white/[0.04] px-5 text-sm font-semibold text-white')}
              >
                Sign in
              </Link>
              <a
                href="#start"
                className={cn(styles.btnPrimary, 'hidden h-[42px] items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)] sm:inline-flex')}
              >
                Request a demo
                <ArrowRight className="h-[15px] w-[15px]" />
              </a>
            </div>
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-[1200px] px-6 pt-16 xl:px-0">
          <div className="max-w-[660px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-600/15 px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              Workforce operations platform
            </span>
            <h1 className="mt-5 text-[40px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[52px] lg:text-[60px]">
              <span className="block">Intelligent workforce</span>
              <span className="block">scheduling for</span>
              <span className="block italic text-cyan-200">modern operations.</span>
            </h1>
            <p className="mt-[22px] max-w-[540px] text-lg leading-[1.6] text-blue-100/80">
              Generate fair rosters, balance designation coverage and manage leave, all from one policy-driven platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                onClick={leaveTo('/login')}
                className={cn(styles.btnPrimary, 'inline-flex h-[50px] items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_-10px_rgba(37,99,235,0.8)]')}
              >
                Sign in to RosterOps
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how"
                className={cn(styles.btnGlass, 'inline-flex h-[50px] items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-[22px] text-[15px] font-semibold text-white')}
              >
                <PlayCircle className="h-[18px] w-[18px]" />
                See how it works
              </a>
            </div>
          </div>
        </div>

        <div className="relative mt-[50px]">
          <ModuleCarousel />
        </div>
      </section>

      <InAction />

      <FourSteps />

      {/* Call to action */}
      <section id="start" className="scroll-mt-6 bg-[#f5f8fd] py-20 lg:py-[104px]">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className={cn(styles.stars, 'relative overflow-hidden rounded-[28px] px-6 pb-24 pt-[76px] text-center sm:px-16')}>
            <div aria-hidden className={styles.horizon} />
            <div className="relative">
              <h2 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-[42px]">Ready to plan your next roster?</h2>
              <p className="mx-auto mt-3.5 max-w-[540px] text-[17px] leading-[1.6] text-blue-100/80">
                Sign in to set your policy, preview the week and publish it to your team.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/login"
                  onClick={leaveTo('/login')}
                  className={cn(styles.btnWhite, 'inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#0b1f4d]')}
                >
                  Sign in to RosterOps
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {/* No demo-request flow exists yet; account sign-up is the closest real destination. */}
                <Link
                  href="/register"
                  onClick={leaveTo('/register')}
                  className={cn(styles.btnGlass, 'inline-flex h-12 items-center rounded-full border border-white/20 bg-white/[0.06] px-[22px] text-[15px] font-semibold text-white')}
                >
                  Request a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-7 sm:flex-row lg:px-10">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-sm font-bold text-slate-900">RosterOps</span>
            <span className="text-[13px] text-slate-500">· Workforce Orchestration Suite</span>
          </div>
          <div className="text-[12.5px] text-slate-500">© 2026 RosterOps · Enterprise Edition</div>
        </div>
      </footer>
    </main>
  );
}
