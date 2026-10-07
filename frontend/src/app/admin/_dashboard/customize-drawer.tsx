'use client';

import { useEffect, useRef } from 'react';
import { GripVertical, X } from 'lucide-react';
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export type WidgetMeta = { id: string; label: string; category: 'Stat' | 'Chart' | 'Table' };

function WidgetRow({ widget, visible, onToggle }: { widget: WidgetMeta; visible: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] border border-[#e6eaf0] bg-white py-2 pl-2 pr-2.5 text-[13px] transition-[opacity,border-color]',
        isDragging && 'z-10 border-dashed opacity-60 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${widget.label}`}
        className="cursor-grab touch-none rounded p-1 text-slate-400 hover:text-slate-900 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={cn('min-w-0 flex-1 truncate', !visible && 'text-slate-400')}>{widget.label}</span>
      <span className="rounded-full bg-[#f2f5f9] px-2 py-px text-[11px] text-slate-500">{widget.category}</span>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label={`Show ${widget.label}`}
        onClick={onToggle}
        className={cn(
          'relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-200',
          visible ? 'bg-primary' : 'bg-[#d5dbe4]',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.2,.7,.3,1)]',
            visible && 'translate-x-[14px]',
          )}
        />
      </button>
    </li>
  );
}

/**
 * Right-hand panel for arranging the dashboard. The page behind stays visible,
 * so cards can be seen gliding into their new places while you drag and toggle.
 */
export function CustomizeDrawer({
  open,
  onClose,
  widgets,
  order,
  hidden,
  onReorder,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  widgets: WidgetMeta[];
  order: string[];
  hidden: string[];
  onReorder: (order: string[]) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onReorder(arrayMove(order, from, to));
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[55] bg-slate-900/15 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        aria-label="Customize dashboard"
        aria-hidden={!open}
        className={cn(
          'fixed inset-y-0 right-0 z-[60] flex w-[min(380px,100vw)] flex-col border-l border-[#e6eaf0] bg-white shadow-[-16px_0_48px_rgba(15,27,45,0.12)]',
          'transition-[transform,visibility] duration-300 ease-[cubic-bezier(.2,.7,.3,1)]',
          open ? 'visible translate-x-0' : 'invisible translate-x-full',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#e6eaf0] px-5 pb-4 pt-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Customize Dashboard</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">Drag to reorder cards. Switch a card off to hide it. The grid rearranges as you go.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-[#f2f5f9] hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-5 py-4">
              {order.map((id) => {
                const widget = widgets.find((item) => item.id === id);
                if (!widget) return null;
                return <WidgetRow key={id} widget={widget} visible={!hidden.includes(id)} onToggle={() => onToggle(id)} />;
              })}
            </ul>
          </SortableContext>
        </DndContext>
        <footer className="flex justify-between gap-2 border-t border-[#e6eaf0] px-5 py-3.5">
          <button type="button" onClick={onReset} className="h-9 rounded-[10px] border border-[#e6eaf0] bg-white px-3.5 text-[13px] font-medium hover:bg-[#f2f5f9]">
            Reset to default
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-white hover:bg-blue-700">
            Done
          </button>
        </footer>
      </aside>
    </>
  );
}
