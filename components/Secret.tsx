import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Secret mode: replaces page names, captions and thumbnails with neutral placeholders
 * so screenshots don't reveal which page it is. Numbers stay visible.
 */
const Ctx = createContext<{ on: boolean; toggle: () => void }>({ on: false, toggle: () => {} });
const KEY = "secret-mode";

export function SecretProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);
  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest("input,textarea,select")) return;
      if (e.shiftKey && (e.key === "S" || e.key === "s")) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  useEffect(() => {
    document.documentElement.dataset.secret = on ? "1" : "0";
    document.title = on ? "Dashboard" : "Reels Dashboard";
  }, [on]);
  return <Ctx.Provider value={{ on, toggle }}>{children}</Ctx.Provider>;
}

export const useSecret = () => useContext(Ctx);

/** Stable masked label for a page, based on its position in the page list. */
export const maskPage = (on: boolean, name: string, index: number) => (on ? `เพจ ${index + 1}` : name);

export function SecretToggle() {
  const { on, toggle } = useSecret();
  return (
    <button onClick={toggle} title="ซ่อนชื่อเพจ/โพสต์/รูป สำหรับแคปหน้าจอ (Shift+S)"
      className={`btn ${on ? "border-gold/50 bg-gold/10 text-gold" : ""}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {on ? (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M1 1l22 22" />
          </>
        ) : (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
      {on ? "Secret: เปิด" : "Secret"}
    </button>
  );
}

const TYPE_ICON: Record<string, string> = { reel: "▶", video: "▶", photo: "▣", text: "¶", link: "↗", story: "◔", other: "•" };

/** Thumbnail that turns into a neutral tile in secret mode. */
export function Thumb({ src, type, size = 44, contain }: { src?: string; type: string; size?: number; contain?: boolean }) {
  const { on } = useSecret();
  const style = { width: size, height: size };
  if (on || !src)
    return (
      <div style={style} className="flex shrink-0 items-center justify-center rounded-[10px] border border-line bg-subtle text-sm text-faint">
        {TYPE_ICON[type] ?? "•"}
      </div>
    );
  return (
    <img src={src} alt="" loading="lazy" style={style}
      className={`shrink-0 rounded-[10px] border border-line bg-subtle ${contain ? "object-contain" : "object-cover"}`} />
  );
}
