"use client";
import { ChevronLeft, ChevronRight, Columns3, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildRows, dayBounds, postNumbers, type PostRow } from "@/lib/analytics";
import type { PageBundle } from "@/lib/data";
import { compact, num, thDate, thDay, TYPE_LABEL, usd } from "@/lib/format";
import { computeWindow, useRangeParam } from "@/lib/range";
import { Thumb, useSecret } from "./Secret";
import { progress } from "./TopProgress";
import { Sparkline } from "./Sparkline";
import { Dash, EmptyState, Growth, RangePicker, SortHeader, TypeBadge } from "./ui";

type SortKey = "title" | "type" | "created" | "views" | "growth" | "revenue" | "totalViews" | "delta"
  | "reactions" | "comments" | "shares" | "followers" | "totalRevenue";

const COLS: { k: SortKey; label: string; optional?: boolean }[] = [
  { k: "views", label: "วิวในช่วง" },
  { k: "growth", label: "เทียบช่วงก่อน" },
  { k: "revenue", label: "รายได้ในช่วง" },
  { k: "totalViews", label: "ยอดดูรวม" },
  { k: "followers", label: "ผู้ติดตามจากโพสต์" },
  { k: "totalRevenue", label: "รายได้รวม" },
  { k: "delta", label: "Δ จาก sync ก่อน", optional: true },
  { k: "reactions", label: "ความรู้สึก", optional: true },
  { k: "comments", label: "คอมเมนต์", optional: true },
  { k: "shares", label: "แชร์", optional: true },
];
const TYPES = ["reel", "photo", "text", "link", "video", "story"] as const;
const PAGE_SIZE = 25;

export function PostsView({ b }: { b: PageBundle }) {
  const { on: secret } = useSecret();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [firstDay, lastDay] = useMemo(() => dayBounds(b), [b]);
  const range = useRangeParam(lastDay);
  const win = computeWindow(range.key, firstDay, lastDay, range.pickDay);
  const nos = useMemo(() => postNumbers(b), [b]);

  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "views", dir: "desc" });
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);
  useEffect(() => setPage(1), [type, q, sort, range.key, range.pickDay]);
  const pick = (t: string) => { setType(t); progress.pulse(); };

  const title = (r: PostRow) => (secret ? `โพสต์ #${nos[r.key]}` : r.p.message || "(ไม่มีข้อความ)");
  const rows = useMemo(() => buildRows(b, win, lastDay), [b, win, lastDay]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.p.type] = (c[r.p.type] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = secret ? "" : q.trim().toLowerCase();
    const list = rows.filter((r) => (type === "all" || r.p.type === type) && (!ql || r.p.message.toLowerCase().includes(ql)));
    const dir = sort.dir === "asc" ? 1 : -1;
    const get = (r: PostRow): number | string => {
      switch (sort.key) {
        case "title": return secret ? nos[r.key] : (r.p.message || "").toLowerCase();
        case "type": return r.p.type;
        case "created": return r.p.createdTime;
        case "growth": return r.growth === null ? Infinity : r.growth ?? -Infinity;
        case "delta": return r.delta ?? -Infinity;
        default: return (r as any)[sort.key] as number;
      }
    };
    return list.sort((a, c) => {
      const x = get(a), y = get(c);
      return (typeof x === "string" ? x.localeCompare(String(y), "th") : x - (y as number)) * dir;
    });
  }, [rows, type, q, sort, secret, nos]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const view = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const maxViews = Math.max(...filtered.map((r) => r.views), 1);
  const totals = filtered.reduce((t, r) => ({ v: t.v + r.views, r: t.r + r.revenue }), { v: 0, r: 0 });
  // hide the comparison column when it carries no information (all posts are new in this window)
  const growthUseful = filtered.some((r) => typeof r.growth === "number");
  const cols = COLS.filter((c) => (more || !c.optional) && (c.k !== "growth" || growthUseful));

  const clearQ = () => {
    setQ("");
    const n = new URLSearchParams(sp.toString());
    n.delete("q");
    window.history.replaceState(null, "", n.toString() ? `${pathname}?${n}` : pathname);
  };

  const cell = (r: PostRow, k: SortKey) => {
    switch (k) {
      case "views":
        return (
          <div className="flex items-center justify-end gap-3">
            <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-subtle xl:block">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.views / maxViews) * 100}%` }} />
            </div>
            <span className="num font-semibold text-text">{num(r.views)}</span>
          </div>
        );
      case "growth": return <Growth g={r.growth} pill />;
      case "revenue": return r.revenue ? <span className="num text-up">{usd(r.revenue)}</span> : <Dash />;
      case "totalViews": return <span className="num">{compact(r.totalViews)}</span>;
      case "followers": return r.followers ? <span className="num text-text">+{num(r.followers)}</span> : <Dash />;
      case "totalRevenue": return r.totalRevenue ? <span className="num font-medium text-text">{usd(r.totalRevenue)}</span> : <Dash />;
      case "delta": return r.delta == null ? <Dash /> : <span className="num">{r.delta > 0 ? "+" : ""}{num(r.delta)}</span>;
      default: return <span className="num">{num((r as any)[k])}</span>;
    }
  };
  const th = (k: SortKey, label: string, align: "left" | "right" = "right") => (
    <SortHeader label={label} align={align} active={sort.key === k} dir={sort.dir} onSort={(dir) => setSort({ key: k, dir })} />
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">โพสต์ทั้งหมด</h1>
          <p className="mt-1 text-sm text-muted">
            {thDay(win.from)}{win.from !== win.to ? ` – ${thDay(win.to)}` : ""} · รวม <b className="num font-semibold text-text">{num(totals.v)}</b> วิว
            · <b className="num font-semibold text-up">{usd(totals.r)}</b>
          </p>
        </div>
        <RangePicker value={range.key} onChange={(r) => range.set({ r })} pickDay={range.pickDay} onPickDay={(d) => range.set({ d })} min={firstDay} max={lastDay} />
      </div>

      <section className="card overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
            {(["all", ...TYPES] as string[]).filter((t) => t === "all" || counts[t]).map((t) => (
              <button key={t} onClick={() => pick(t)}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                  type === t ? "bg-text text-bg" : "text-muted hover:bg-hover hover:text-text"}`}>
                {t === "all" ? "ทั้งหมด" : TYPE_LABEL[t]}
                <span className={`num text-xs ${type === t ? "opacity-70" : "text-faint"}`}>{counts[t] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input w-full pl-9 pr-8 sm:w-60" placeholder={secret ? "ปิดใน Secret mode" : "ค้นหา caption…"} disabled={secret}
                value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา caption" />
              {q && !secret && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-text" onClick={clearQ} aria-label="ล้างคำค้น"><X size={14} /></button>
              )}
            </div>
            <button className={`btn hidden md:inline-flex ${more ? "border-primary/60 bg-primary-soft" : ""}`} onClick={() => setMore((v) => !v)} aria-pressed={more}>
              <Columns3 size={15} />{more ? "คอลัมน์หลัก" : "คอลัมน์เพิ่ม"}
            </button>
          </div>
        </div>

        {!view.length ? (
          <EmptyState title="ไม่พบโพสต์" hint={q ? "ลองเปลี่ยนคำค้น หรือเลือกประเภทอื่น" : "ยังไม่มีข้อมูล — กด Sync เพื่อดึงข้อมูล"} />
        ) : (
          <>
            {/* mobile: cards */}
            <ul className="divide-y divide-line md:hidden">
              {view.map((r) => (
                <li key={r.key}>
                  <Link href={`/p/${b.page.id}/post/${r.key}`} className="flex gap-3 p-4 transition-colors hover:bg-hover active:bg-hover">
                    <Thumb src={r.p.picture} type={r.p.type} size={56} />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-snug">{title(r)}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted"><TypeBadge type={r.p.type} />{thDate(r.p.createdTime)}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div><div className="text-muted">วิวในช่วง</div><div className="num font-semibold text-text">{compact(r.views)}</div></div>
                        <div><div className="text-muted">รายได้</div><div className="num font-semibold text-up">{r.revenue ? usd(r.revenue) : "–"}</div></div>
                        <div><div className="text-muted">เทียบก่อน</div><Growth g={r.growth} size="xs" /></div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-subtle text-xs font-medium text-muted">
                  <tr className="border-b border-line">
                    <th className="w-12 px-4 py-3 text-left font-medium">#</th>
                    <th className="sticky left-0 z-10 min-w-[280px] bg-subtle px-3 py-3 text-left font-medium">{th("title", "โพสต์", "left")}</th>
                    <th className="px-3 py-3 text-left font-medium">{th("type", "ประเภท", "left")}</th>
                    <th className="px-3 py-3 text-left font-medium">{th("created", "วันที่โพสต์", "left")}</th>
                    <th className="px-3 py-3 text-left font-medium">14 วันล่าสุด</th>
                    {cols.map((c) => <th key={c.k} className="px-3 py-3 text-right font-medium">{th(c.k, c.label)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {view.map((r, i) => (
                    <tr key={r.key} className="group cursor-pointer transition-colors hover:bg-hover" onClick={() => router.push(`/p/${b.page.id}/post/${r.key}`)}>
                      <td className="num whitespace-nowrap px-4 py-3 text-xs text-faint">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="sticky left-0 bg-surface px-3 py-2.5 transition-colors group-hover:bg-hover">
                        <Link href={`/p/${b.page.id}/post/${r.key}`} className="flex max-w-[380px] items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Thumb src={r.p.picture} type={r.p.type} size={42} />
                          <div className="min-w-0">
                            <div className="truncate font-medium transition-colors group-hover:text-primary-text">{title(r)}</div>
                            {r.p.length ? <div className="num text-xs text-muted">{r.p.length} วินาที</div> : null}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5"><TypeBadge type={r.p.type} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{thDate(r.p.createdTime)}</td>
                      <td className="px-3 py-2.5"><Sparkline values={r.spark} width={80} height={22} /></td>
                      {cols.map((c) => <td key={c.k} className="whitespace-nowrap px-3 py-2.5 text-right text-muted">{cell(r, c.k)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
          <span>
            แสดง <b className="num text-text">{filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)}</b> จาก <b className="num text-text">{filtered.length}</b>
          </span>
          <div className="flex items-center gap-1">
            <button className="btn btn-icon h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="หน้าก่อน"><ChevronLeft size={16} /></button>
            {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1).map((n, i, arr) => (
              <span key={n} className="flex items-center">
                {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-faint">…</span>}
                <button onClick={() => { setPage(n); progress.pulse(); }} className={`num h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium transition-colors ${n === page ? "bg-text text-bg" : "hover:bg-hover hover:text-text"}`}>{n}</button>
              </span>
            ))}
            <button className="btn btn-icon h-8 w-8" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="หน้าถัดไป"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
