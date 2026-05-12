'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero / Brand panel */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-to-br from-primary/90 via-primary to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">RosterOps</div>
            <div className="text-xs opacity-80">Workforce Orchestration Suite</div>
          </div>
        </div>
        <div className="relative space-y-4 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Intelligent workforce scheduling for modern operations.
          </h2>
          <p className="text-white/80">
            Generate fair rosters across thousands of employees, balance designation
            coverage, handle leaves dynamically, and gain full operational visibility.
          </p>
          <ul className="space-y-2 text-sm text-white/80 pt-2">
            <li>• Auto roster generation with fairness scoring</li>
            <li>• Multi-project, multi-location workforce</li>
            <li>• Leave-aware reallocation</li>
            <li>• Real-time staffing analytics</li>
          </ul>
        </div>
        <div className="relative text-xs text-white/60">© RosterOps · Enterprise Edition</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Enter your credentials to access the platform.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="text-sm text-muted-foreground text-center">
            New employee?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
