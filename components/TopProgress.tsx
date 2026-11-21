import { usePathname, useSearchParams } from "@/lib/nav";
import { useEffect, useRef, useState } from "react";

/**
 * Thin progress bar at the top of the viewport.
 * - starts on internal link clicks and finishes when the route actually changes
 * - can be driven manually: progress.start() / progress.done()  (e.g. while syncing)
 */
const EVT = "app-progress";
export const progress = {
  start: () => window.dispatchEvent(new CustomEvent(EVT, { detail: "start" })),
  done: () => window.dispatchEvent(new CustomEvent(EVT, { detail: "done" })),
  /** quick feedback for instant client-side updates */
  pulse: () => {
    progress.start();
    setTimeout(progress.done, 260);
  },
};

export function TopProgress() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [w, setW] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setVisible(true);
    setW(8);
    timer.current = setInterval(() => setW((x) => (x < 85 ? x + (90 - x) * 0.12 : x)), 160);
  };
  const done = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setW(100);
    setTimeout(() => {
      setVisible(false);
      setW(0);
    }, 220);
  };

  // finish whenever the URL changes
  useEffect(() => {
    if (visible) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp]);

  useEffect(() => {
    const onEvt = (e: Event) => ((e as CustomEvent).detail === "start" ? start() : done());
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== location.origin) return;
      if (a.pathname + a.search === location.pathname + location.search) return;
      start();
    };
    window.addEventListener(EVT, onEvt);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener(EVT, onEvt);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2.5px]">
      <div className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${w}%`, opacity: visible ? 1 : 0 }} />
    </div>
  );
}
