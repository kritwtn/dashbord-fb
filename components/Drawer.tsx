import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Right-side sheet. Esc / backdrop / close button dismiss it; focus moves into the panel and
 * returns to the trigger on close; page scroll is locked while open. Full-width on mobile.
 */
export function Drawer({ open, onClose, title, subtitle, icon, children, footer }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90]" role="presentation">
      <div className="drawer-backdrop absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        className="drawer-panel absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-[var(--shadow-pop)] outline-none sm:w-[460px] sm:border-l sm:border-line">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          <button className="btn btn-ghost btn-icon -mr-2 -mt-1" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-line px-5 py-3 text-xs leading-relaxed text-muted">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
