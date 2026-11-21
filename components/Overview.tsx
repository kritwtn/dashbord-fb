"use client";
import { ChevronLeft, ChevronRight, CircleDollarSign, Eye, Heart, PlayCircle, UserPlus, Users } from "lucide-react";
import Link from "next/link";
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
import { Dash, EmptyState, Growth, RangePicker, TypeBadge } from "./ui";

type KpiDef = { key: keyof PageDay; label: string; color: string; icon: typeof Eye; money?: boolean };
const KPIS: KpiDef[] = [
  { key: "mediaViews", label: "ยอดดูเพจ", color: "var(--color-c1)", icon: Eye },
  { key: "videoViews", label: "วิดีโอวิว", color: "var(--color-c2)", icon: PlayCircle },
  { key: "reach", label: "ผู้ชม", color: "var(--color-c3)", icon: Users },
  { key: "newFollows", label: "ผู้ติดตามใหม่", color: "var(--color-c4)", icon: UserPlus },
  { key: "revenue", label: "รายได้", color: "var(--color-c5)", icon: CircleDollarSign, money: true },
];
const EXTRA: KpiDef[] = [
  { key: "engagements", label: "การมีส่วนร่วม", color: "var(--color-c6)", icon: Heart },
  { key: "follows", label: "ผู้ติดตามรวม", color: "var(--color-c4)", icon: Users },
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
  const topRange = [...rows].filter((r) => r.views > 0).sort((a, c) => c.views - a.views).slice(0, 6);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
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
            <button key={k.key} onClick={() => setMetric(k.key)} aria-pressed={active}
              className={`card group flex flex-col p-4 text-left transition duration-150 hover:border-line-strong hover:shadow-[var(--shadow-pop)] ${
                active ? "!border-primary ring-3 ring-primary/20" : ""} ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-muted">
                <k.icon size={15} style={{ color: k.color }} />{k.label}
              </div>
              <div className="num mt-3 text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">{k.money ? usd(cur) : num(cur)}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Growth g={win.prevFrom ? pct(cur, prev) : undefined} pill />
                <span className="whitespace-nowrap text-xs text-muted">{win.prevFrom ? `จาก ${k.money ? usd(prev) : compact(prev)}` : `${span} วัน`}</span>
              </div>
              <div className="mt-3 h-8 w-full"><Sparkline values={chartDays.map((d) => b.pageDaily[d]?.[k.key] ?? 0)} width={240} height={32} color={k.color} fluid /></div>
            </button>
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
          <div className="seg no-scrollbar max-w-full overflow-x-auto">
            {[...KPIS, ...EXTRA].map((m) => (
              <button key={m.key} data-active={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>
            ))}
          </div>
        </div>
        <div className="px-2 pb-3 pt-4 sm:px-4">
          <DailyChart data={chartData} series={[
            { key: "cur", label: cm.label, kind: metric === "follows" ? "line" : "area", color: cm.color, labels: true, format: cm.money ? money : undefined },
            ...(ghost ? [{ key: "prev", label: "ช่วงก่อนหน้า", kind: "ghost" as const, color: cm.color, format: cm.money ? money : undefined }] : []),
          ]} />
        </div>
      </section>

      <DailySummary b={b} firstDay={firstDay} lastDay={lastDay} title={title} />

      {/* Top posts in range */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">โพสต์ที่ทำผลงานดีที่สุดในช่วงนี้</div>
          <Link href={`/p/${b.page.id}/posts${range.query ? `?${range.query}` : ""}`} className="btn btn-ghost h-8 text-[13px]">
            ดูทั้งหมด <ChevronRight size={15} />
          </Link>
        </div>
        {topRange.length ? (
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {topRange.map((r, i) => (
              <li key={r.key} className="bg-surface">
                <Link href={`/p/${b.page.id}/post/${r.key}`} className="group flex items-center gap-3 p-4 transition-colors hover:bg-hover">
                  <span className="num w-4 text-sm font-semibold text-faint">{i + 1}</span>
                  <Thumb src={r.p.picture} type={r.p.type} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm leading-snug group-hover:text-primary-text">{title(r.key, r.p)}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="num font-semibold text-text">{compact(r.views)} วิว</span>
                      {r.revenue > 0 && <span className="num text-up">{usd(r.revenue)}</span>}
                      <TypeBadge type={r.p.type} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="ยังไม่มีวิวในช่วงนี้" hint="ลองเลือกช่วงเวลาอื่น หรือกด Sync เพื่อดึงข้อมูลล่าสุด" />}
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
        <div className="flex flex-1 flex-col justify-end px-5 pb-4 pt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>ยอดดู 7 วันล่าสุด</span><span>กดแท่งเพื่อเลือกวัน</span>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {week.map((w) => (
              <button key={w.day} onClick={() => setDay(w.day)} title={`${thDay(w.day)} · ${num(w.v)}`}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className={`num text-[10px] ${w.day === day ? "font-semibold text-text" : "text-faint group-hover:text-muted"}`}>{compact(w.v)}</span>
                <span className={`w-full rounded-t-md transition-colors ${w.day === day ? "bg-primary" : "bg-subtle group-hover:bg-line-strong"}`}
                  style={{ height: `${Math.max(4, (w.v / weekMax) * 64)}px` }} />
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
