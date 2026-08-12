'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      toast('Welcome back', 'success');
      router.replace(user.role === 'ADMIN' ? '/admin' : '/employee');
    } catch (err: any) {
      toast(err?.message ?? 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-950">
      <section className="relative min-h-screen lg:hidden">
        <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 px-6 py-8 text-white">
          <div className="mb-14 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/25 bg-white/15">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight">RosterOps</div>
              <div className="text-sm text-white/85">Workforce Orchestration Suite</div>
            </div>
          </div>

          <h1 className="text-[34px] font-bold leading-tight">
            Intelligent workforce scheduling for <span className="italic text-cyan-100">modern operations.</span>
          </h1>
        </div>

        <div className="px-6 py-10">
          <LoginForm
            email={email}
            password={password}
            loading={loading}
            setEmail={setEmail}
            setPassword={setPassword}
            onSubmit={onSubmit}
          />
        </div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-white lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(rgba(255,255,255,0.95)_1px,transparent_1px)] [background-size:19px_19px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.12),transparent_34%)]" />
        </div>

        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full text-white"
          preserveAspectRatio="none"
          viewBox="0 0 747 306"
        >
          <path
            fill="currentColor"
            d="M402 0C382 31 366 62 362 91C358 121 368 139 379 158C395 185 395 209 383 236C371 262 354 283 350 306H747V0Z"
          />
        </svg>

        <div className="absolute left-[6.6%] top-[5%] z-10 flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">RosterOps</div>
            <div className="text-sm text-white/85">Workforce Orchestration Suite</div>
          </div>
        </div>

        <div className="absolute left-[6.6%] top-[29%] z-10 text-white">
          <h1 className="text-[34px] font-bold leading-[1.15] tracking-tight">
            Intelligent workforce scheduling
            <br />
            for <span className="italic text-cyan-100">modern operations.</span>
          </h1>
          <p className="mt-6 max-w-[540px] text-[17px] leading-7 text-white">
            Generate fair rosters across thousands of employees, balance designation
            coverage, handle leaves dynamically, and gain full operational visibility.
          </p>
        </div>

        <ul className="absolute left-[6.6%] top-[60%] z-10 space-y-2.5 text-[15px] text-white">
          {[
            'Auto roster generation with fairness scoring',
            'Multi-project, multi-location workforce',
            'Leave-aware reallocation',
            'Real-time staffing analytics',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="absolute bottom-[3%] left-[6.6%] z-10 text-sm text-white/80">
          © RosterOps · Enterprise Edition
        </div>

        <div className="absolute left-[62.5%] top-1/2 z-10 w-[30%] min-w-[380px] max-w-[420px] -translate-y-1/2">
          <LoginForm
            email={email}
            password={password}
            loading={loading}
            setEmail={setEmail}
            setPassword={setPassword}
            onSubmit={onSubmit}
          />
        </div>
      </section>
    </main>
  );
}

function LoginForm({
  email,
  password,
  loading,
  setEmail,
  setPassword,
  onSubmit,
}: {
  email: string;
  password: string;
  loading: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="w-full">
      <div className="mb-7">
        <h2 className="text-[30px] font-bold leading-none tracking-tight text-slate-950">
          Sign in
        </h2>
        <p className="mt-3 text-[15px] text-slate-600">
          Enter your credentials to access the platform.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2.5">
          <Label htmlFor="email" className="text-[15px] font-semibold text-slate-950">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-md border-slate-200 bg-white text-base shadow-sm focus-visible:ring-blue-600"
          />
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="password" className="text-[15px] font-semibold text-slate-950">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-md border-slate-200 bg-white text-base shadow-sm focus-visible:ring-blue-600"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-blue-600 text-base font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="mt-8 text-center text-[15px] text-slate-500">
        New employee?{' '}
        <Link href="/register" className="font-semibold text-blue-600 hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}
