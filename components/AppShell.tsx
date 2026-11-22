import {
  Bell, ChevronDown, Clock, Eye, EyeOff, Globe2, History, LayoutDashboard, ListVideo, LogOut, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, X,
} from "lucide-react";
import Link from "@/lib/nav";
import { usePathname, useRouter, useSearchParams } from "@/lib/nav";
import { useEffect, useRef, useState } from "react";
import { compact, thDate } from "@/lib/format";
import type { PageInfo, SyncRun } from "@/lib/types";
import { maskPage, useSecret } from "./Secret";
import { ThemeToggle } from "./Theme";
import { useToast } from "./Toast";
import { progress } from "./TopProgress";
import { logout } from "@/lib/auth";
import { syncPage } from "@/lib/sync";

type Props = {
  pages: PageInfo[];
  pageId: string;
  email: string;
  syncs: SyncRun[];
  children: React.ReactNode;
};

function useClickAway<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open, close]);
  return ref;
}

export function AppShell({ pages, pageId, email, syncs, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const { on: secret, toggle: toggleSecret } = useSecret();
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState<"" | "sync" | "full">("");
  const [bell, setBell] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((v) => {
    try { localStorage.setItem("sidebar-collapsed", v ? "0" : "1"); } catch {}
    return !v;
  });
  const bellRef = useClickAway<HTMLDivElement>(bell, () => setBell(false));
  const userRef = useClickAway<HTMLDivElement>(userMenu, () => setUserMenu(false));

  useEffect(() => setDrawer(false), [pathname, pageId]);

  const idx = Math.max(0, pages.findIndex((p) => p.id === pageId));
  const page = pages[idx];
  const qs = (() => {
    const n = new URLSearchParams(sp.toString());
    n.delete("q");
    const s = n.toString();
    return s ? `?${s}` : "";
  })();
  const nav = [
    { href: `/p/${pageId}`, label: "ภาพรวม", icon: LayoutDashboard, active: pathname === `/p/${pageId}` },
    { href: `/p/${pageId}/posts`, label: "โพสต์ทั้งหมด", icon: ListVideo, active: pathname.startsWith(`/p/${pageId}/post`) },
    { href: `/p/${pageId}/timing`, label: "เวลาโพสต์", icon: Clock, active: pathname.startsWith(`/p/${pageId}/timing`) },
    { href: `/p/${pageId}/audience`, label: "ผู้ติดตาม", icon: Globe2, active: pathname.startsWith(`/p/${pageId}/audience`) },
  ];
  const title = nav.find((n) => n.active)?.label ?? "รายละเอียดโพสต์";
  const last = syncs[0];
  const stale = !last || Date.now() - last.at > 26 * 3600 * 1000;

  async function sync(full: boolean) {
    setBusy(full ? "full" : "sync");
    setUserMenu(false);
    progress.start();
    try {
      // runs in the browser: Graph API allows CORS, the page token comes from the (admin-only) database
      const run = await syncPage(pageId, { source: "api", full });
      toast({ kind: "success", title: full ? "ดึงข้อมูลย้อนหลังเรียบร้อย" : "Sync เรียบร้อย",
        detail: `อัปเดต ${run.refreshed ?? run.postCount} จาก ${run.postCount} โพสต์ · ข้อมูลรายวัน ${run.dailyDays ?? "-"} วันล่าสุด` });
      router.refresh();
    } catch (e: any) {
      toast({ kind: "error", title: "Sync ไม่สำเร็จ", detail: e.message });
    } finally {
      setBusy("");
      progress.done();
    }
  }

  async function doLogout() {
    await logout();
    router.push("/login");
  }

  const renderSidebar = (mini: boolean) => (
    <div className="flex h-full flex-col">
      <div className={`flex h-14 items-center gap-2.5 ${mini ? "justify-center px-2" : "px-4"}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-ink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>
        </span>
        {!mini && <span className="font-semibold tracking-tight">Reels Insight</span>}
        {!mini && <button className="btn btn-ghost btn-icon ml-auto lg:hidden" onClick={() => setDrawer(false)} aria-label="ปิดเมนู"><X size={18} /></button>}
      </div>

      <div className={`pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint ${mini ? "text-center" : "px-5"}`}>{mini ? "•" : "เมนู"}</div>
      <nav className={`space-y-0.5 ${mini ? "px-2" : "px-3"}`} aria-label="เมนูหลัก">
        {nav.map((n) => (
          <Link key={n.href} href={`${n.href}${qs}`} title={mini ? n.label : undefined} aria-current={n.active ? "page" : undefined}
            className={`relative flex h-9 items-center gap-2.5 rounded-[10px] text-sm font-medium transition-colors ${mini ? "justify-center" : "px-2.5"} ${
              n.active ? "bg-primary-soft text-text" : "text-muted hover:bg-hover hover:text-text"}`}>
            {n.active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" aria-hidden />}
            <n.icon size={17} className={n.active ? "text-primary-text" : ""} />
            {!mini && n.label}
          </Link>
        ))}
      </nav>

      <div className={`mt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint ${mini ? "text-center" : "px-5"}`}>{mini ? "เพจ" : `เพจ (${pages.length})`}</div>
      <div className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3 ${mini ? "px-2" : "px-3"}`}>
        {pages.map((p, i) => {
          const active = p.id === pageId;
          const rest = pathname.replace(`/p/${pageId}`, "");
          const sub = ["/posts", "/audience", "/timing"].find((x) => rest.startsWith(x)) ?? "";
          const name = maskPage(secret, p.name, i);
          return mini ? (
            <Link key={p.id} href={`/p/${p.id}${sub}${qs}`} title={name} aria-current={active ? "page" : undefined}
              className={`num flex h-9 items-center justify-center rounded-[10px] text-xs font-semibold transition-colors ${
                active ? "bg-primary text-primary-ink" : "text-muted hover:bg-hover hover:text-text"}`}>
              {i + 1}
            </Link>
          ) : (
            <Link key={p.id} href={`/p/${p.id}${sub}${qs}`} aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 transition-colors ${active ? "bg-hover" : "hover:bg-hover"}`}>
              {active && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" aria-hidden />}
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[13px] ${active ? "font-semibold text-text" : "text-muted group-hover:text-text"}`}>{name}</div>
                <div className="num text-[11px] text-faint">{p.followers ? `${compact(p.followers)} ผู้ติดตาม` : "—"}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className={`flex items-center gap-2 border-t border-line p-3 ${mini ? "flex-col" : ""}`}>
        <div className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-xs text-muted ${mini ? "justify-center" : ""}`}
          title={last ? `sync ล่าสุด ${thDate(new Date(last.at).toISOString())} (เวลาไทย)` : "ยังไม่เคย sync"}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${stale ? "bg-primary" : "bg-up"}`} />
          {!mini && <span className="truncate">{last ? <>sync ล่าสุด {thDate(new Date(last.at).toISOString())}</> : "ยังไม่เคย sync"}</span>}
        </div>
        <button className="btn btn-ghost btn-icon hidden h-8 w-8 shrink-0 lg:inline-flex" onClick={toggleCollapsed}
          aria-label={mini ? "ขยายแถบด้านข้าง" : "ย่อแถบด้านข้าง"} title={mini ? "ขยายแถบด้านข้าง" : "ย่อแถบด้านข้าง"}>
          {mini ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
      {/* Sidebar: fixed on desktop, drawer on mobile */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface transition-[width] duration-200 lg:block ${collapsed ? "w-[72px]" : "w-[260px]"}`}>
        {renderSidebar(collapsed)}
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="slide-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface shadow-[var(--shadow-pop)]">{renderSidebar(false)}</aside>
        </div>
      )}

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <button className="btn btn-ghost btn-icon -ml-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="เปิดเมนู"><Menu size={19} /></button>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{title}</div>
            <div className="hidden truncate text-xs text-muted sm:block">{page ? maskPage(secret, page.name, idx) : ""}</div>
          </div>

          <form className="relative ml-auto hidden md:block" onSubmit={(e) => { e.preventDefault(); progress.start(); router.push(`/p/${pageId}/posts?${new URLSearchParams({ ...Object.fromEntries(sp), q }).toString()}`); }}>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className="input w-56 pl-9 lg:w-72" placeholder={secret ? "ค้นหาถูกปิดใน Secret mode" : "ค้นหาโพสต์…"} disabled={secret}
              value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาโพสต์" />
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <button className={`btn btn-icon ${secret ? "border-primary/50 bg-primary-soft text-primary-text" : "btn-ghost"}`} onClick={toggleSecret}
              aria-pressed={secret} title="Secret mode — ซ่อนชื่อเพจ/โพสต์/รูป (Shift+S)" aria-label="Secret mode">
              {secret ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <ThemeToggle />

            <div className="relative" ref={bellRef}>
              <button className="btn btn-ghost btn-icon relative" onClick={() => setBell((v) => !v)} aria-label="การแจ้งเตือน">
                <Bell size={17} />
                {stale && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-bg" />}
              </button>
              {bell && (
                <div className="menu right-0 w-80">
                  <div className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-muted">ประวัติการ sync · เวลาไทย</div>
                  {stale && (
                    <div className="mx-1 mb-1 rounded-lg bg-primary-soft px-2.5 py-2 text-xs text-text">
                      ข้อมูลเก่ากว่า 1 วัน — กด Sync เพื่ออัปเดต
                    </div>
                  )}
                  {syncs.length ? syncs.map((s) => (
                    <div key={s.id} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.error ? "bg-down" : "bg-up"}`} />
                      <div className="min-w-0">
                        <div>{s.full ? "ดึงย้อนหลังทั้งหมด" : s.source === "cron" ? "Sync อัตโนมัติ" : s.source === "csv" ? "นำเข้า CSV" : "Sync"}</div>
                        <div className="text-xs text-muted">{thDate(new Date(s.at).toISOString())} · {s.refreshed ?? s.postCount}/{s.postCount} โพสต์</div>
                      </div>
                    </div>
                  )) : <div className="px-2.5 py-6 text-center text-sm text-muted">ยังไม่มีประวัติ</div>}
                </div>
              )}
            </div>

            <button className="btn btn-primary ml-1" disabled={!!busy} onClick={() => sync(false)} title="ดึงข้อมูลตั้งแต่ sync ครั้งก่อนถึงวันนี้">
              <RefreshCw size={15} className={busy === "sync" ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{busy === "sync" ? "กำลัง sync…" : busy === "full" ? "กำลังดึง…" : "Sync"}</span>
            </button>

            <div className="relative ml-1" ref={userRef}>
              <button className="flex h-9 items-center gap-1.5 rounded-[10px] pl-1 pr-1.5 hover:bg-hover" onClick={() => setUserMenu((v) => !v)} aria-label="บัญชีผู้ใช้">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-text text-xs font-semibold text-bg">
                  {email.charAt(0).toUpperCase()}
                </span>
                <ChevronDown size={14} className="hidden text-muted sm:block" />
              </button>
              {userMenu && (
                <div className="menu right-0">
                  <div className="truncate px-2.5 pb-2 pt-1.5 text-xs text-muted">{email}</div>
                  <button className="menu-item" disabled={!!busy} onClick={() => sync(true)}>
                    <History size={16} className="text-muted" />
                    <div>
                      <div>ดึงข้อมูลย้อนหลังทั้งหมด</div>
                      <div className="text-xs text-muted">ตั้งแต่โพสต์แรก (ช้ากว่า)</div>
                    </div>
                  </button>
                  <div className="my-1 h-px bg-line" />
                  <button className="menu-item" onClick={doLogout}><LogOut size={16} className="text-muted" />ออกจากระบบ</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
