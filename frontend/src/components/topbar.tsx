'use client';
import { Bell } from 'lucide-react';

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex-1">
        <h1 className="text-base font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <button className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent">
        <Bell className="h-4 w-4" />
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
      </button>
    </header>
  );
}
