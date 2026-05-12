'use client';
import * as React from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: string; kind: ToastKind; title?: string; message: string }
interface ToastCtx { toast: (m: string, kind?: ToastKind, title?: string) => void }

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'info', title?: string) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, kind, message, title }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
        {items.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border bg-card shadow-lg p-3 animate-in slide-in-from-right',
                t.kind === 'success' && 'border-emerald-200',
                t.kind === 'error' && 'border-red-200',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  t.kind === 'success' && 'text-emerald-600',
                  t.kind === 'error' && 'text-red-600',
                  t.kind === 'info' && 'text-blue-600',
                )}
              />
              <div className="flex-1 text-sm">
                {t.title && <div className="font-medium">{t.title}</div>}
                <div className="text-muted-foreground">{t.message}</div>
              </div>
              <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="opacity-50 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be inside ToastProvider');
  return c;
}
