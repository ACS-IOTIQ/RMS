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

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', employeeCode: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(form.email, form.password, form.employeeCode || undefined);
      toast('Account created', 'success');
      router.replace(user.role === 'ADMIN' ? '/admin' : '/employee');
    } catch (err: any) {
      toast(err?.message ?? 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Enter your employee code to link your existing record.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeCode">Employee code (optional)</Label>
            <Input id="employeeCode" placeholder="EMP1001" value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            <p className="text-xs text-muted-foreground">Leave blank to register as standalone user.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        <div className="text-sm text-muted-foreground text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
