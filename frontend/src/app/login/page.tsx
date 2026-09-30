import type { Metadata } from 'next';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { IndiaNetworkMap } from './india-network-map';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in · RosterOps' };

// The 1536×1024 background is drawn at "cover" scale anchored bottom-right, and the
// layout is sized in the same units, so content stays on the right part of the artwork
// at any window size: one source pixel = PX on screen.
const PX = 'max(100vw / 1536, 100vh / 1024)';
const px = (n: number) => `calc(${PX} * ${n})`;
// The white curved panel begins at x≈1018–1048 in the source.
const FORM_COLUMN = 1536 - 1060;
// The earth's glow rises to y≈780–830 beneath the map; India's southern tip may dip into it.
const EARTH = 1024 - 860;
// Keeps the map's right edge (Arunachal) just clear of the curve's glow.
const CURVE_GAP = 48;

const HIGHLIGHTS = [
  'Auto roster generation with fairness scoring',
  'Multi-project, multi-location workforce',
  'Leave-aware reallocation',
  'Real-time staffing analytics',
];

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#001233]">
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-0 bg-[url('/login-bg.webp')] bg-[length:100%_100%]"
        style={{ width: px(1536), height: px(1024) }}
      />

      <div className="relative hidden flex-1 lg:block">
        <div className="absolute left-12 top-10 xl:left-16">
          <Brand onDark />
        </div>

        <div
          className="absolute left-12 top-24 flex gap-6 xl:left-16 xl:top-6"
          style={{ bottom: px(EARTH), right: px(CURVE_GAP) }}
        >
          <div className="hidden w-[min(400px,40%)] shrink-0 flex-col justify-center text-white xl:flex">
            <p className="text-[30px] font-bold leading-[1.15] tracking-tight 2xl:text-[38px] [@media(max-height:720px)]:text-[28px]">
              Intelligent workforce scheduling for <span className="italic text-cyan-200">modern operations.</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-blue-100/80 2xl:text-[15px]">
              Generate fair rosters across thousands of employees, balance designation coverage, handle leaves
              dynamically, and gain full operational visibility.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-blue-50/90 2xl:text-[15px]">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <IndiaNetworkMap className="min-w-0 flex-1" />
        </div>
      </div>

      <section
        className="relative ml-auto flex min-h-screen shrink-0 flex-col px-6 py-8"
        style={{ width: `min(100%, ${px(FORM_COLUMN)})` }}
      >
        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[400px] rounded-2xl border border-white bg-white/80 p-6 shadow-[0_24px_64px_-24px_rgba(8,32,110,0.45)] backdrop-blur-md xl:p-8">
            <LoginForm />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">© RosterOps · Enterprise Edition</p>
      </section>
    </main>
  );
}

function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={46} />
      <div className="leading-tight">
        <div className={cn('text-[17px] font-bold tracking-tight', onDark ? 'text-white' : 'text-slate-900')}>RosterOps</div>
        <div className={cn('text-xs', onDark ? 'text-blue-100/70' : 'text-slate-500')}>Workforce Orchestration Suite</div>
      </div>
    </div>
  );
}
