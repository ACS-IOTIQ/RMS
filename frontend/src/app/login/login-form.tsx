'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';

const fieldClass =
  'h-11 rounded-lg border-slate-200 bg-white pl-10 text-[15px] text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/15';

const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400';

export function LoginForm() {
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
    } catch (err) {
      toast((err as { message?: string })?.message ?? 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-[30px] font-bold leading-tight tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-2 text-[15px] text-slate-500">Sign in to your RosterOps account</p>

      <form onSubmit={onSubmit} className="mt-9 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">
            Email
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
            <Mail className={iconClass} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700">
            Password
          </Label>
          <div className="relative">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
            />
            <Lock className={iconClass} />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="!mt-7 h-11 w-full gap-2 rounded-lg bg-blue-600 text-[15px] font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
          {loading ? null : <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        New employee?{' '}
        <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
