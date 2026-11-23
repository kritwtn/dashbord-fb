import { ChevronLeft, ChevronRight, CircleDollarSign, Eye, Hash, Heart, Info, PlayCircle, UserPlus, Users } from "lucide-react";
import Link from "@/lib/nav";
import { useMemo, useState } from "react";
import { buildRows, dayBounds, pageSum, postNumbers } from "@/lib/analytics";
import { loadFollowGains, type PageBundle } from "@/lib/data";
import { useData } from "@/lib/useData";
import { addDays, compact, daysBetween, metaDay, num, pct, thDate, thDay, usd } from "@/lib/format";
import { computeWindow, useRangeParam } from "@/lib/range";
import type { PageDay, PostInfo } from "@/lib/types";
import { DailyChart, Legend } from "./DailyChart";
import { DatePicker } from "./DatePicker";
import { Drawer } from "./Drawer";
import { maskPage, Thumb, useSecret } from "./Secret";
import { Sparkline } from "./Sparkline";
import { Dash, EmptyState, Growth, InfoTip, MetaDay, RangePicker, TypeBadge, WeekdayFilter } from "./ui";

type KpiDef = { key: keyof PageDay; label: string; color: string; icon: typeof Eye; money?: boolean; help: string };
const KPIS: KpiDef[] = [
  { key: "mediaViews", label: "ยอดดูเพจ", color: "var(--color-c1)", icon: Eye, help: "จำนวนครั้งที่เนื้อหาของเพจถูกแสดงบนหน้าจอ (Views) รวมทุกโพสต์" },
  { key: "videoViews", label: "วิดีโอวิว", color: "var(--color-c2)", icon: PlayCircle, help: "จำนวนครั้งที่วิดีโอ/Reels ถูกดูนานอย่างน้อย 3 วินาที" },
  { key: "reach", label: "ผู้ชม", color: "var(--color-c3)", icon: Users, help: "จำนวนคนที่เห็นเนื้อหา (ไม่นับซ้ำในแต่ละวัน) รวมตามวัน" },
  { key: "newFollows", label: "ผู้ติดตามใหม่", color: "var(--color-c4)", icon: UserPlus, help: "จำนวนผู้ติดตามที่เพิ่มขึ้นในแต่ละวัน รวมตามช่วงที่เลือก" },
  { key: "revenue", label: "รายได้", color: "var(--color-c5)", icon: CircleDollarSign, money: true, help: "รายได้โดยประมาณจากการสร้างรายได้ของเนื้อหา (USD) ตาม Meta" },
];
const EXTRA: KpiDef[] = [
  { key: "engagements", label: "การมีส่วนร่วม", color: "var(--color-c6)", icon: Heart, help: "ความรู้สึก คอมเมนต์ แชร์ และคลิกบนโพสต์" },
  { key: "follows", label: "ผู้ติดตามรวม", color: "var(--color-c4)", icon: Users, help: "จำนวนผู้ติดตามทั้งหมด ณ สิ้นวัน" },
];
const money = (n: number) => `$${n.toFixed(n >= 100 ? 0 : 2)}`;

export function Overview({ b, pageIndex }: { b: PageBundle; pageIndex: number }) {
  const { on: secret } = useSecret();
  const [firstDay, lastDay] = useMemo(() => dayBounds(b), [b]);
  const range = useRangeParam(lastDay);
  const win = computeWindow(range.key, firstDay, lastDay, range.pickDay);
  const [metric, setMetric] = useState<keyof PageDay>("mediaViews");
  const nos = useMemo(() => postNumbers(b), [b]);
  const title = (key: string, p: PostInfo) => (secret ? `โพสต์ #${nos[key]}` : p.message || "(ไม่มีข้อความ)");

  const chartDays = range.key === "all" ? daysBetween(firstDay, lastDay) : daysBetween(addDays(win.to, -Math.max(13, win.len - 1)), win.to);
  const span = chartDays.length;
  const cm = [...KPIS, ...EXTRA].find((m) => m.key === metric)!;
  const ghost = range.key !== "all" && metric !== "follows";
  const chartData = chartDays.map((day) => ({
    day,
    cur: range.allow && !range.allow(day) ? null : b.pageDaily[day]?.[metric] ?? null,
    prev: ghost && (!range.allow || range.allow(addDays(day, -span))) ? b.pageDaily[addDays(day, -span)]?.[metric] ?? null : null,
  }));

  const rows = useMemo(() => buildRows(b, win, lastDay, range.allow), [b, win, lastDay, range.allow]);
  const [topBy, setTopBy] = useState<"views" | "revenue" | "engagement">("views");
  const topVal = (r: (typeof rows)[number]) => (topBy === "views" ? r.views : topBy === "revenue" ? r.revenue : r.reactions + r.comments + r.shares);
  const topRange = [...rows].filter((r) => topVal(r) > 0).sort((a, c) => topVal(c) - topVal(a)).slice(0, 8);
  const topMax = Math.max(1, ...topRange.map(topVal));
  const [showLabels, setShowLabels] = useState(() => {
    try { return localStorage.getItem("chart-labels") !== "0"; } catch { return true; }
  });
  const toggleLabels = () => setShowLabels((v) => { try { localStorage.setItem("chart-labels", v ? "0" : "1"); } catch {} return !v; });

  return (
    <div className="fade-in mx-auto max-w-[1280px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{maskPage(secret, b.page.name, pageIndex)}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="whitespace-nowrap"><span className="num font-medium text-text">{num(b.page.followers)}</span> ผู้ติดตาม</span>
            <span className="mx-2 text-line-strong">|</span>
            <span className="whitespace-nowrap">{thDay(win.from)}{win.from !== win.to ? ` – ${thDay(win.to)}` : ""}</span>
            {win.prevFrom && <span className="whitespace-nowrap text-faint"> · เทียบ {thDay(win.prevFrom)}{win.prevFrom !== win.prevTo ? ` – ${thDay(win.prevTo)}` : ""}</span>}
                      <MetaDay className="ml-2 align-middle" />
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <RangePicker value={range.key} onChange={(r) => range.set({ r })} pickDay={range.pickDay} onPickDay={(d) => range.set({ d })} min={firstDay} max={lastDay} />
          <WeekdayFilter mask={range.mask} onChange={(w) => range.set({ w })} />
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {KPIS.map((k, i) => {
          const cur = pageSum(b, k.key, win.from, win.to, range.allow);
          const prev = pageSum(b, k.key, win.prevFrom, win.prevTo, range.allow);
          const active = metric === k.key;
          return (
            <div key={k.key} role="button" tabIndex={0} onClick={() => setMetric(k.key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setMetric(k.key))} aria-pressed={active}
              aria-label={`${k.label} ${k.money ? usd(cur) : num(cur)} — แสดงในกราฟ`}
              className={`card group flex cursor-pointer flex-col p-4 text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-pop)] focus-visible:ring-3 focus-visible:ring-primary/40 active:translate-y-0 ${
                active ? "!border-primary ring-3 ring-primary/20" : ""} ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-muted">
                <k.icon size={15} style={{ color: k.color }} />{k.label}
                <span className="ml-auto"><InfoTip text={k.help} side="bottom" /></span>
              </div>
              <div className="num mt-3 text-[26px] font-semibold leading-none tracking-tight text-text sm:text-[28px]">{k.money ? usd(cur) : num(cur)}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1"
                title={win.prevFrom ? `ช่วงก่อนหน้า ${thDay(win.prevFrom)} – ${thDay(win.prevTo)}: ${k.money ? usd(prev) : num(prev)}` : undefined}>
                <Growth g={win.prevFrom ? pct(cur, prev) : undefined} pill />
                <span className="whitespace-nowrap text-xs text-muted">{win.prevFrom ? `จาก ${k.money ? usd(prev) : compact(prev)} ช่วงก่อน` : `${span} วัน`}</span>
              </div>
              <div className="mt-3 h-8 w-full"><Sparkline values={chartDays.map((d) => (range.allow && !range.allow(d) ? 0 : b.pageDaily[d]?.[k.key] ?? 0))} width={240} height={32} color={k.color} fluid /></div>
            </div>
          );
        })}
      </section>

      {/* Trend */}
      <section className="card">
        <div className="card-header">
          <div className="min-w-0">
            <div className="card-title flex items-center gap-2">แนวโน้มรายวัน <MetaDay /></div>
            <div className="mt-1"><Legend items={[{ label: cm.label, color: cm.color }, ...(ghost ? [{ label: "ช่วงก่อนหน้า", color: "var(--color-faint)", dashed: true }] : [])]} /></div>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <div className="seg no-scrollbar min-w-0 max-w-full overflow-x-auto">
              {[...KPIS, ...EXTRA].map((m) => (
                <button key={m.key} data-active={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>
              ))}
            </div>
            <button className={`btn btn-icon h-9 w-9 shrink-0 ${showLabels ? "border-primary/60 bg-primary-soft text-primary-text" : "text-muted"}`}
              onClick={toggleLabels} aria-pressed={showLabels} title={showLabels ? "ซ่อนตัวเลขบนกราฟ" : "แสดงตัวเลขบนกราฟ"} aria-label="แสดงตัวเลขบนกราฟ">
              <Hash size={15} />
            </button>
          </div>
        </div>
        <div key={`${metric}-${range.key}`} className="fade-in px-2 pb-3 pt-4 sm:px-4">
          <DailyChart compare={ghost} data={chartData} series={[
            { key: "cur", label: cm.label, kind: metric === "follows" ? "line" : "area", color: cm.color, labels: showLabels, format: cm.money ? money : undefined },
            ...(ghost ? [{ key: "prev", label: "ช่วงก่อนหน้า", kind: "ghost" as const, color: cm.color, format: cm.money ? money : undefined }] : []),
          ]} />
        </div>
      </section>

      <DailySummary b={b} firstDay={firstDay} lastDay={lastDay} title={title} />

      {/* Top performing in range */}
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-2">โพสต์ที่ทำผลงานดีที่สุด <MetaDay /></div>
            <div className="mt-0.5 text-xs text-muted">ในช่วง {thDay(win.from)}{win.from !== win.to ? ` – ${thDay(win.to)}` : ""}{topBy === "engagement" ? " · การมีส่วนร่วมเป็นยอดสะสม" : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="seg" role="tablist" aria-label="เรียงตาม">
              <button data-active={topBy === "views"} onClick={() => setTopBy("views")}>วิว</button>
              <button data-active={topBy === "revenue"} onClick={() => setTopBy("revenue")}>รายได้</button>
              <button data-active={topBy === "engagement"} onClick={() => setTopBy("engagement")}>Engagement</button>
            </div>
            <Link href={`/p/${b.page.id}/posts${range.query ? `?${range.query}` : ""}`} className="btn btn-ghost hidden h-8 text-[13px] sm:inline-flex">
              ดูทั้งหมด <ChevronRight size={15} />
            </Link>
          </div>
        </div>
        {topRange.length ? (
          <ol className="divide-y divide-line">
            {topRange.map((r, i) => {
              const v = topVal(r);
              return (
                <li key={r.key}>
                  <Link href={`/p/${b.page.id}/post/${r.key}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover sm:gap-4">
                    <span className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${
                      i === 0 ? "bg-primary text-primary-ink" : i < 3 ? "bg-primary-soft text-primary-text" : "text-faint"}`}>{i + 1}</span>
                    <div className="relative shrink-0">
                      <Thumb src={r.p.picture} type={r.p.type} size={48} />
                      {r.p.length ? <span className="num absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] leading-4 text-white">{Math.floor(r.p.length / 60)}:{String(r.p.length % 60).padStart(2, "0")}</span> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text transition-colors group-hover:text-primary-text">{title(r.key, r.p)}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(v / topMax) * 100}%` }} />
                        </div>
                        <span className="hidden sm:inline"><TypeBadge type={r.p.type} /></span>
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <div className={`num text-sm font-semibold ${topBy === "revenue" ? "text-up" : "text-text"}`}>
                        {topBy === "views" ? num(r.views) : topBy === "revenue" ? usd(r.revenue) : num(v)}
                      </div>
                      <div className="num mt-0.5 text-xs text-muted">
                        {topBy === "views" ? (r.revenue ? usd(r.revenue) : "—") : `${compact(r.views)} วิว`}
                      </div>
                    </div>
                    <ChevronRight size={16} className="hidden shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text sm:block" />
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : <EmptyState title={topBy === "revenue" ? "ยังไม่มีรายได้ในช่วงนี้" : "ยังไม่มีข้อมูลในช่วงนี้"} hint="ลองเลือกช่วงเวลาอื่น หรือกด Sync เพื่อดึงข้อมูลล่าสุด" />}
      </section>

      <p className="text-xs leading-relaxed text-muted">
        ข้อมูลรายวันใช้ "วันของ Meta" (เวลาแปซิฟิก) ซึ่ง 1 วัน = 15:00 ถึง 15:00 ของวันถัดไปตามเวลาไทย (14:00 ช่วงเวลาออมแสงของสหรัฐฯ) · โพสต์ก่อน 15:00 จะถูกนับเป็นวันก่อนหน้า · วันล่าสุดยังไม่จบวัน ตัวเลขจะอัปเดตเมื่อ sync ครั้งถัดไป
      </p>
    </div>
  );
}

function DailySummary({ b, firstDay, lastDay, title }: { b: PageBundle; firstDay: string; lastDay: string; title: (k: string, p: PostInfo) => string }) {
  const [day, setDay] = useState(lastDay);
  const [by, setBy] = useState<"v" | "r" | "f">("v");
  const prevDay = addDays(day, -1);
  // followers per post: Meta only gives a lifetime total, so the per-day gain comes from sync snapshots
  const follow = useData(
    () => loadFollowGains(b.page.id, day, Object.fromEntries(Object.entries(b.posts).map(([k, p]) => [k, p.createdTime]))),
    [b.page.id, day, b.lastSync?.id],
  ).data;
  const vDay = (k: string) => b.postDaily[k]?.[day]?.v ?? 0;
  const vSum = useMemo(() => Object.keys(b.posts).reduce((a, k) => a + (b.postDaily[k]?.[day]?.v ?? 0), 0), [b, day]);
  // followers gained by a clip ON THE SELECTED DAY: measured between syncs, or page new follows × clip's share of that day's video views
  const fVal = (k: string) =>
    follow ? follow.gain[k] ?? 0 : vSum ? Math.round(((b.pageDaily[day]?.newFollows ?? 0) * vDay(k)) / vSum) : 0;
  const pd = b.pageDaily[day] ?? {};
  const pp = b.pageDaily[prevDay] ?? {};
  const top = useMemo(() => Object.entries(b.posts)
    .map(([key, p]) => ({ key, p, v: b.postDaily[key]?.[day]?.v ?? 0, r: b.postDaily[key]?.[day]?.r ?? 0, f: fVal(key) }))
    .filter((x) => x[by] > 0).sort((a, c) => c[by] - a[by]).slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b, day, by, follow]);
  const newPosts = useMemo(() => Object.values(b.posts).filter((p) => metaDay(p.createdTime) === day).length, [b.posts, day]);
  const weekEnd = day > addDays(lastDay, -3) ? lastDay : addDays(day, 3);
  const week = daysBetween(addDays(weekEnd, -6), weekEnd).filter((d) => d >= firstDay).map((d) => ({ day: d, v: b.pageDaily[d]?.mediaViews ?? 0 }));
  const weekMax = Math.max(...week.map((w) => w.v), 1);
  const stats: Stat[] = [
    { kind: "views", label: "ยอดดู", cur: pd.mediaViews, prev: pp.mediaViews, color: "var(--color-c1)", icon: Eye },
    { kind: "video", label: "วิดีโอวิว", cur: pd.videoViews, prev: pp.videoViews, color: "var(--color-c2)", icon: PlayCircle },
    { kind: "reach", label: "ผู้ชม", cur: pd.reach, prev: pp.reach, color: "var(--color-c3)", icon: Users },
    { kind: "follows", label: "ผู้ติดตามใหม่", cur: pd.newFollows, prev: pp.newFollows, plus: true, color: "var(--color-c4)", icon: UserPlus },
    { kind: "revenue", label: "รายได้", cur: pd.revenue, prev: pp.revenue, money: true, color: "var(--color-c5)", icon: CircleDollarSign },
    { kind: "engage", label: "การมีส่วนร่วม", cur: pd.engagements, prev: pp.engagements, color: "var(--color-c6)", icon: Heart },
  ];
  const [detail, setDetail] = useState<Stat | null>(null);

  return (
    <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="card flex min-w-0 flex-col">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="card-title flex items-center gap-2">สรุปประจำวัน <MetaDay /></span>
            {day === lastDay && <span className="badge bg-primary-soft text-primary-text">วันนี้ · ยังไม่จบวัน</span>}
          </div>
          <div className="flex items-center gap-1">
            <button className="btn btn-icon h-8 w-8" disabled={day <= firstDay} onClick={() => setDay(addDays(day, -1))} aria-label="วันก่อนหน้า"><ChevronLeft size={16} /></button>
            <DatePicker value={day} onChange={setDay} min={firstDay} max={lastDay} size="sm" align="right" label="เลือกวันของสรุป" />
            <button className="btn btn-icon h-8 w-8" disabled={day >= lastDay} onClick={() => setDay(addDays(day, 1))} aria-label="วันถัดไป"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
          {stats.map((s) => (
            <button key={s.label} onClick={() => setDetail(s)} title={`ดูว่า${s.label}มาจากคลิปไหนบ้าง`}
              className="group flex flex-col justify-center bg-surface px-5 py-4 text-left transition-colors hover:bg-hover">
              <div className="flex w-full items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}
                <ChevronRight size={14} className="ml-auto text-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
              <div className="num mt-1.5 text-xl font-semibold">
                {s.cur == null ? <Dash /> : s.money ? usd(s.cur) : `${s.plus && s.cur > 0 ? "+" : ""}${num(s.cur)}`}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <Growth g={s.cur == null ? undefined : pct(s.cur, s.prev ?? 0)} size="xs" />
                <span className="text-muted">vs {thDay(prevDay)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col px-5 pb-4 pt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>ยอดดู 7 วันล่าสุด</span><span>กดแท่งเพื่อเลือกวัน</span>
          </div>
          <div className="flex min-h-28 flex-1 items-stretch gap-1.5">
            {week.map((w) => (
              <button key={w.day} onClick={() => setDay(w.day)} title={`${thDay(w.day)} · ${num(w.v)}`} aria-pressed={w.day === day}
                className="group flex flex-1 flex-col items-center gap-1">
                <span className="flex w-full flex-1 flex-col items-center justify-end gap-1">
                  <span className={`num text-[10px] ${w.day === day ? "font-semibold text-text" : "text-faint group-hover:text-muted"}`}>{compact(w.v)}</span>
                  <span className={`w-full rounded-t-md transition-[height,background-color] duration-300 ${w.day === day ? "bg-primary" : "bg-subtle group-hover:bg-line-strong"}`}
                    style={{ height: `${Math.max(4, (w.v / weekMax) * 78)}%` }} />
                </span>
                <span className={`text-[10px] ${w.day === day ? "font-medium text-text" : "text-faint"}`}>{thDay(w.day).split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-between gap-3 border-t border-line px-5 py-3 text-sm text-muted">
          <span>ผู้ติดตามรวม <b className="num font-semibold text-text">{num(pd.follows || b.page.followers)}</b></span>
          <span>โพสต์ใหม่ <b className="num font-semibold text-text">{newPosts}</b></span>
        </div>
      </div>

      <div className="card flex min-w-0 flex-col">
        <div className="card-header">
          <span className="card-title flex flex-wrap items-center gap-2">ยอดนิยมของวัน · Top 10 <span className="text-sm font-normal text-muted">{thDay(day)}</span><MetaDay /></span>
          <div className="seg">
            <button data-active={by === "v"} onClick={() => setBy("v")}>วิว</button>
            <button data-active={by === "r"} onClick={() => setBy("r")}>รายได้</button>
            <button data-active={by === "f"} onClick={() => setBy("f")}>ผู้ติดตาม</button>
          </div>
        </div>
        {by === "f" && follow !== undefined && (
          <div className="flex items-start gap-2 border-b border-line bg-primary-soft px-5 py-2 text-xs text-text">
            <Info size={14} className="mt-0.5 shrink-0 text-primary-text" />
            <span>{follow ? followWindowNote(follow) : <><b>≈ ประมาณการ</b>: ผู้ติดตามใหม่ของเพจวันนี้ แบ่งตามสัดส่วนวิดีโอวิวของแต่ละคลิป (ไม่มี sync ใกล้ขอบวันพอให้คำนวณ)</>}</span>
          </div>
        )}
        {top.length ? (
          <ol className="flex-1 divide-y divide-line">
            {top.map((t, i) => {
              const share = (t[by] / Math.max(top[0][by], 1)) * 100;
              return (
                <li key={t.key}>
                  <Link href={`/p/${b.page.id}/post/${t.key}`} className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-hover">
                    <span className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${i < 3 ? "bg-primary-soft text-primary-text" : "text-faint"}`}>{i + 1}</span>
                    <Thumb src={t.p.picture} type={t.p.type} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm group-hover:text-primary-text">{title(t.key, t.p)}</div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-subtle">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <div className={`num text-sm font-semibold ${by === "r" ? "text-up" : ""}`}>
                        {by === "v" ? num(t.v) : by === "r" ? usd(t.r) : `≈ +${num(t.f)}`}
                      </div>
                      <div className="num text-xs text-muted">{by === "v" ? (t.r ? usd(t.r) : "") : `${compact(t.v)} วิว`}</div>
                    </div>
                    {by !== "f" && <div className="hidden w-20 text-right sm:block" title="ประมาณการผู้ติดตามที่ได้จากคลิปในวันที่เลือก">
                      <div className="num inline-flex items-center gap-1 text-sm font-medium text-text">
                        <UserPlus size={13} className="text-[var(--color-c4)]" />
                        {t.f ? `≈+${num(t.f)}` : "–"}
                      </div>
                      <div className="text-[11px] text-muted">ผู้ติดตามวันนี้</div>
                    </div>}
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : <EmptyState title="ไม่มีข้อมูลของวันนี้" hint="Meta อาจยังไม่อัปเดตตัวเลขของวันนี้ ลองเลือกวันก่อนหน้า" />}
      </div>
      <Breakdown stat={detail} onClose={() => setDetail(null)} b={b} day={day} prevDay={prevDay} title={title} follow={follow} />
    </section>
  );
}

type Stat = { kind: "views" | "video" | "reach" | "follows" | "revenue" | "engage"; label: string; cur?: number; prev?: number;
  money?: boolean; plus?: boolean; color: string; icon: typeof Eye };

type FollowGains = { gain: Record<string, number>; fromAt: number; toAt: number };
const followWindowNote = (f: FollowGains, pageTotal?: number) => (
  <>
    <b>≈ นับระหว่าง sync</b> {thDate(new Date(f.fromAt).toISOString())} ถึง {thDate(new Date(f.toAt).toISOString())} (เวลาไทย)
    {pageTotal != null && <> · ผลรวมของคลิปจึงไม่เท่ากับยอดเพจ +{num(pageTotal)}</>}
  </>
);

const BASIS: Record<Stat["kind"], string> = {
  video: "วิดีโอวิว (ดูนาน 3 วินาทีขึ้นไป) ของแต่ละคลิปในวันที่เลือก จากข้อมูลรายวันของ Meta",
  revenue: "รายได้ของแต่ละคลิปในวันที่เลือก จากข้อมูลรายวันของ Meta",
  views: "≈ ประมาณการ: Meta ไม่มียอดดูรายวันแยกต่อคลิป จึงแบ่งยอดดูของเพจวันนั้นตามสัดส่วนวิดีโอวิวของแต่ละคลิปในวันเดียวกัน",
  reach: "≈ ประมาณการ: Meta ไม่มีผู้ชมรายวันแยกต่อคลิป จึงแบ่งผู้ชมของเพจวันนั้นตามสัดส่วนวิดีโอวิวของแต่ละคลิปในวันเดียวกัน",
  engage: "≈ ประมาณการ: Meta ไม่มีการมีส่วนร่วมรายวันแยกต่อคลิป จึงแบ่งยอดของเพจวันนั้นตามสัดส่วนวิดีโอวิวของแต่ละคลิปในวันเดียวกัน",
  follows: "ผู้ติดตามที่ได้จากแต่ละคลิปในวันที่เลือก: ≈ คำนวณจากผลต่างของ sync ที่ใกล้ต้นวันและท้ายวันของ Meta ที่สุด ถ้าไม่มี sync ใกล้พอ จะแบ่งผู้ติดตามใหม่ของเพจตามสัดส่วนวิดีโอวิว",
};

function Breakdown({ stat, onClose, b, day, prevDay, title, follow }: {
  stat: Stat | null; onClose: () => void; b: PageBundle; day: string; prevDay: string;
  title: (k: string, p: PostInfo) => string; follow?: FollowGains | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const pageTotal = stat?.cur ?? 0;
  const exact = !!stat && (stat.kind === "video" || stat.kind === "revenue");
  const items = useMemo(() => {
    if (!stat) return [];
    const rows = Object.entries(b.posts).map(([key, p]) => {
      const d = b.postDaily[key]?.[day];
      return { key, p, views: d?.v ?? 0, rev: d?.r ?? 0, v: 0 };
    });
    const vSum = rows.reduce((a, x) => a + x.views, 0);
    for (const x of rows)
      x.v = stat.kind === "video" ? x.views
        : stat.kind === "revenue" ? x.rev
        : stat.kind === "follows" && follow ? follow.gain[x.key] ?? 0
        : vSum ? (pageTotal * x.views) / vSum : 0; // ≈ share of that day's video views
    return rows.filter((x) => x.v > 0).sort((a, c) => c.v - a.v);
  }, [stat, b, day, follow, pageTotal]);
  if (!stat) return null;

  const fmt = (n: number) => (stat.money ? usd(n) : num(Math.round(n)));
  const show = (n: number) => `${exact ? "" : "≈ "}${stat.kind === "follows" ? "+" : ""}${fmt(n)}`;
  const attributed = items.reduce((a, x) => a + x.v, 0);
  const remainder = exact ? Math.max(0, pageTotal - attributed) : 0;
  // followers measured between syncs don't add up to the page total, so shares are of the clips' own sum
  const measured = stat.kind === "follows" && follow ? follow : null;
  const denom = exact ? Math.max(pageTotal, attributed) : measured ? attributed : pageTotal || attributed;
  const share = (n: number) => (denom ? (n / denom) * 100 : 0);
  const top3 = items.slice(0, 3).reduce((a, x) => a + x.v, 0);
  const list = showAll ? items : items.slice(0, 15);
  const palette = ["var(--color-c1)", "var(--color-c2)", "var(--color-c3)", "var(--color-c4)", "var(--color-c6)"];
  return (
    <Drawer open onClose={() => { setShowAll(false); onClose(); }}
      icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${stat.color} 15%, transparent)`, color: stat.color }}><stat.icon size={18} /></span>}
      title={`${stat.label} มาจากคลิปไหนบ้าง`}
      subtitle={`${thDay(day)} · เทียบ ${thDay(prevDay)} · วันของ Meta (15:00–15:00 เวลาไทย)`}
      footer={BASIS[stat.kind]}>
      {/* hero */}
      <div className="px-5 pb-4 pt-5">
        <div className="text-xs font-medium text-muted">{stat.label}ของเพจทั้งวัน</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="num text-3xl font-semibold tracking-tight">{stat.cur == null ? "–" : `${stat.plus && pageTotal > 0 ? "+" : ""}${fmt(pageTotal)}`}</span>
          <Growth g={stat.cur == null ? undefined : pct(pageTotal, stat.prev ?? 0)} pill />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-subtle px-3 py-2.5">
            <div className="text-muted">จากคลิป</div>
            <div className="num mt-0.5 text-base font-semibold">{num(items.length)}</div>
          </div>
          <div className="rounded-xl bg-subtle px-3 py-2.5">
            <div className="text-muted">รวมจากคลิป</div>
            <div className="num mt-0.5 truncate text-base font-semibold">{exact ? "" : "≈ "}{fmt(attributed)}</div>
          </div>
          <div className="rounded-xl bg-subtle px-3 py-2.5">
            <div className="text-muted">Top 3</div>
            <div className="num mt-0.5 text-base font-semibold">{share(top3).toFixed(0)}%</div>
          </div>
        </div>
        {/* stacked share bar */}
        {items.length > 0 && (
          <div className="mt-4">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-subtle">
              {items.slice(0, 5).map((x, i) => (
                <span key={x.key} title={`${i + 1}. ${share(x.v).toFixed(1)}%`} style={{ width: `${share(x.v)}%`, background: palette[i] }} className="h-full first:rounded-l-full" />
              ))}
              <span className="h-full flex-1 bg-line-strong/60" />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted"><span>5 อันดับแรก</span><span>อื่นๆ</span></div>
          </div>
        )}
        {!exact && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-xs">
            <Info size={14} className="mt-0.5 shrink-0 text-primary-text" />
            <span>{measured ? followWindowNote(measured, pageTotal) : <><b>≈ ประมาณการ</b> — Meta ไม่มี{stat.label}รายวันแยกต่อคลิป{stat.kind === "follows" ? " (และไม่มี sync ใกล้ขอบวันพอให้คำนวณ)" : ""} จึงแบ่งยอด{thDay(day)}ของเพจตามสัดส่วนวิดีโอวิวของแต่ละคลิปในวันนั้น</>}</span>
          </div>
        )}
      </div>

      {/* list */}
      {items.length ? (
        <ol className="border-t border-line">
          {list.map((x, i) => (
            <li key={x.key} className="border-b border-line last:border-b-0">
              <Link href={`/p/${b.page.id}/post/${x.key}`} onClick={onClose}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover">
                <span className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${i < 3 ? "bg-primary-soft text-primary-text" : "text-faint"}`}>{i + 1}</span>
                <Thumb src={x.p.picture} type={x.p.type} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[13px] leading-snug group-hover:text-primary-text">{title(x.key, x.p)}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, share(x.v))}%`, background: i < 5 ? palette[i] : "var(--color-faint)" }} />
                    </div>
                    <span className="num w-11 text-right text-[11px] text-muted">{share(x.v).toFixed(share(x.v) < 10 ? 1 : 0)}%</span>
                  </div>
                </div>
                <div className="w-20 shrink-0 text-right">
                  <div className={`num text-sm font-semibold ${stat.kind === "revenue" ? "text-up" : ""}`}>
                    {show(x.v)}
                  </div>
                  <div className="text-[11px] text-muted">{stat.kind === "video" ? "" : `${compact(x.views)} วิว`}</div>
                </div>
              </Link>
            </li>
          ))}
          {remainder > 0 && (
            <li className="flex items-center gap-3 border-t border-dashed border-line px-5 py-3 text-muted">
              <span className="w-6" />
              <span className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-dashed border-line-strong text-xs">อื่นๆ</span>
              <div className="min-w-0 flex-1 text-[13px]">โพสต์อื่น / โพสต์เก่าที่ไม่อยู่ในระบบ<div className="num text-[11px]">{share(remainder).toFixed(1)}%</div></div>
              <div className="num w-20 text-right text-sm font-medium">{fmt(remainder)}</div>
            </li>
          )}
        </ol>
      ) : (
        <EmptyState title="ไม่มีข้อมูลรายคลิปของวันนี้" hint="Meta อาจยังไม่อัปเดตตัวเลขรายคลิป ลองเลือกวันก่อนหน้า" />
      )}
      {items.length > 15 && (
        <div className="px-5 py-3">
          <button className="btn w-full" onClick={() => setShowAll((v) => !v)}>{showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${items.length} คลิป`}</button>
        </div>
      )}
    </Drawer>
  );
}
