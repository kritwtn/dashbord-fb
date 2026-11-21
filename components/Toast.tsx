"use client";
import { CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; kind: "success" | "error" | "info"; title: string; detail?: string };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { ...t, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-pop)]">
            {t.kind === "success" ? <CheckCircle2 size={18} className="mt-0.5 text-up" />
              : <Info size={18} className={`mt-0.5 ${t.kind === "error" ? "text-primary-text" : "text-muted"}`} />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.title}</div>
              {t.detail && <div className="mt-0.5 text-xs text-muted">{t.detail}</div>}
            </div>
            <button className="text-faint hover:text-text" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} aria-label="ปิด">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
