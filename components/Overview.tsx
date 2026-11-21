import { ChevronLeft, ChevronRight, CircleDollarSign, Eye, Hash, Heart, PlayCircle, UserPlus, Users } from "lucide-react";
import Link from "@/lib/nav";
import { useMemo, useState } from "react";
import { buildRows, dayBounds, pageSum, postNumbers } from "@/lib/analytics";
import type { PageBundle } from "@/lib/data";
import { addDays, compact, daysBetween, metaDay, num, pct, thDay, usd } from "@/lib/format";
import { computeWindow, useRangeParam } from "@/lib/range";
import type { PageDay, PostInfo } from "@/lib/types";
import { DailyChart, Legend } from "./DailyChart";
import { DatePicker } from "./DatePicker";
import { maskPage, Thumb, useSecret } from "./Secret";
import { Sparkline } from "./Sparkline";
import { Dash, EmptyState, Growth, InfoTip, RangePicker, TypeBadge } from "./ui";

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
    cur: b.pageDaily[day]?.[metric] ?? null,
    prev: ghost ? b.pageDaily[addDays(day, -span)]?.[metric] ?? null : null,
  }));

  const rows = useMemo(() => buildRows(b, win, lastDay), [b, win, lastDay]);
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
          </p>
        </div>
        <RangePicker value={range.key} onChange={(r) => range.set({ r })} pickDay={range.pickDay} onPickDay={(d) => range.set({ d })} min={firstDay} max={lastDay} />
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {KPIS.map((k, i) => {
          const cur = pageSum(b, k.key, win.from, win.to);
          const prev = pageSum(b, k.key, win.prevFrom, win.prevTo);
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
              <div className="mt-3 h-8 w-full"><Sparkline values={chartDays.map((d) => b.pageDaily[d]?.[k.key] ?? 0)} width={240} height={32} color={k.color} fluid /></div>
            </div>
          );
        })}
      </section>

      {/* Trend */}
      <section className="card">
        <div className="card-header">
          <div className="min-w-0">
            <div className="card-title">แนวโน้มรายวัน</div>
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
            <div className="card-title">โพสต์ที่ทำผลงานดีที่สุด</div>
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
        ข้อมูลรายวันใช้วันตามเวลาของ Meta (Pacific Time) · วันล่าสุดยังไม่จบวัน ตัวเลขจะอัปเดตเมื่อ sync ครั้งถัดไป
      </p>
    </div>
  );
}

function DailySummary({ b, firstDay, lastDay, title }: { b: PageBundle; firstDay: string; lastDay: string; title: (k: string, p: PostInfo) => string }) {
  const [day, setDay] = useState(lastDay);
  const [by, setBy] = useState<"v" | "r">("v");
  const prevDay = addDays(day, -1);
  const pd = b.pageDaily[day] ?? {};
  const pp = b.pageDaily[prevDay] ?? {};
  const top = useMemo(() => Object.entries(b.posts)
    .map(([key, p]) => ({ key, p, v: b.postDaily[key]?.[day]?.v ?? 0, r: b.postDaily[key]?.[day]?.r ?? 0 }))
    .filter((x) => x[by] > 0).sort((a, c) => c[by] - a[by]).slice(0, 10), [b, day, by]);
  const newPosts = useMemo(() => Object.values(b.posts).filter((p) => metaDay(p.createdTime) === day).length, [b.posts, day]);
  const weekEnd = day > addDays(lastDay, -3) ? lastDay : addDays(day, 3);
  const week = daysBetween(addDays(weekEnd, -6), weekEnd).filter((d) => d >= firstDay).map((d) => ({ day: d, v: b.pageDaily[d]?.mediaViews ?? 0 }));
  const weekMax = Math.max(...week.map((w) => w.v), 1);
  const stats: { label: string; cur?: number; prev?: number; money?: boolean; plus?: boolean; color: string }[] = [
    { label: "ยอดดู", cur: pd.mediaViews, prev: pp.mediaViews, color: "var(--color-c1)" },
    { label: "วิดีโอวิว", cur: pd.videoViews, prev: pp.videoViews, color: "var(--color-c2)" },
    { label: "ผู้ชม", cur: pd.reach, prev: pp.reach, color: "var(--color-c3)" },
    { label: "ผู้ติดตามใหม่", cur: pd.newFollows, prev: pp.newFollows, plus: true, color: "var(--color-c4)" },
    { label: "รายได้", cur: pd.revenue, prev: pp.revenue, money: true, color: "var(--color-c5)" },
    { label: "การมีส่วนร่วม", cur: pd.engagements, prev: pp.engagements, color: "var(--color-c6)" },
  ];

  return (
    <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="card flex min-w-0 flex-col">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="card-title">สรุปประจำวัน</span>
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
            <div key={s.label} className="flex flex-col justify-center bg-surface px-5 py-4">
              <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}
              </div>
              <div className="num mt-1.5 text-xl font-semibold">
                {s.cur == null ? <Dash /> : s.money ? usd(s.cur) : `${s.plus && s.cur > 0 ? "+" : ""}${num(s.cur)}`}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <Growth g={s.cur == null ? undefined : pct(s.cur, s.prev ?? 0)} size="xs" />
                <span className="text-muted">vs {thDay(prevDay)}</span>
              </div>
            </div>
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
          <span className="card-title">ยอดนิยมของวัน · Top 10 <span className="ml-1 text-sm font-normal text-muted">{thDay(day)}</span></span>
          <div className="seg">
            <button data-active={by === "v"} onClick={() => setBy("v")}>วิว</button>
            <button data-active={by === "r"} onClick={() => setBy("r")}>รายได้</button>
          </div>
        </div>
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
                    <div className="w-20 text-right">
                      <div className={`num text-sm font-semibold ${by === "r" ? "text-up" : ""}`}>{by === "v" ? num(t.v) : usd(t.r)}</div>
                      <div className="num text-xs text-muted">{by === "v" ? (t.r ? usd(t.r) : "") : `${compact(t.v)} วิว`}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : <EmptyState title="ไม่มีข้อมูลของวันนี้" hint="Meta อาจยังไม่อัปเดตตัวเลขของวันนี้ ลองเลือกวันก่อนหน้า" />}
      </div>
    </section>
  );
}
