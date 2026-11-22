import { CalendarDays, Clock, Sparkles, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { dayBounds, postNumbers } from "@/lib/analytics";
import type { PageBundle } from "@/lib/data";
import { addDays, compact, metaDay, num, thDate, thDay, TYPE_LABEL, usd } from "@/lib/format";
import Link from "@/lib/nav";
import { computeWindow, useRangeParam, WEEKDAY_LABELS } from "@/lib/range";
import type { PostInfo } from "@/lib/types";
import { Drawer } from "./Drawer";
import { Thumb, useSecret } from "./Secret";
import { EmptyState, InfoTip, RangePicker, TypeBadge, WeekdayFilter } from "./ui";

type Metric = "views" | "revenue" | "followers";
type Stat = "median" | "mean";
const DAY_NAMES = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const MIN_N = 2; // slots with fewer posts are shown faded and excluded from "best"

/** Bangkok weekday (Mon=0) and hour of a post. */
function slotOf(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return { wd: (d.getUTCDay() + 6) % 7, hour: d.getUTCHours() };
}
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

type PostPerf = { key: string; p: PostInfo; wd: number; hour: number; value: number; views: number };

export function TimingView({ b }: { b: PageBundle }) {
  const { on: secret } = useSecret();
  const [firstDay, lastDay] = useMemo(() => dayBounds(b), [b]);
  const range = useRangeParam(lastDay);
  const win = computeWindow(range.key, firstDay, lastDay, range.pickDay);
  const [metric, setMetric] = useState<Metric>("views");
  const [windowDays, setWindowDays] = useState(3);
  const [stat, setStat] = useState<Stat>("median");
  const [type, setType] = useState("all");
  const [cell, setCell] = useState<{ wd?: number; hour?: number } | null>(null);
  const nos = useMemo(() => postNumbers(b), [b]);
  const title = (k: string, p: PostInfo) => (secret ? `โพสต์ #${nos[k]}` : p.message || "(ไม่มีข้อความ)");

  // performance of each post over its first N days (only posts old enough, posted inside the range)
  const perf: PostPerf[] = useMemo(() => {
    const out: PostPerf[] = [];
    for (const [key, p] of Object.entries(b.posts)) {
      if (p.type === "story") continue;
      if (type !== "all" && p.type !== type) continue;
      const day0 = metaDay(p.createdTime);
      if (day0 < win.from || day0 > win.to) continue;
      if (range.allow && !range.allow(day0)) continue;
      const end = addDays(day0, windowDays - 1);
      if (end >= lastDay) continue; // window not complete yet (today is partial)
      let v = 0, r = 0;
      for (let d = day0; d <= end; d = addDays(d, 1)) {
        v += b.postDaily[key]?.[d]?.v ?? 0;
        r += b.postDaily[key]?.[d]?.r ?? 0;
      }
      const value = metric === "views" ? v : metric === "revenue" ? r : b.latest[key]?.followersGained ?? 0;
      out.push({ key, p, ...slotOf(p.createdTime), value, views: v });
    }
    return out;
  }, [b, win.from, win.to, range.allow, windowDays, lastDay, metric, type]);

  const agg = stat === "median" ? median : mean;
  const grid = useMemo(() => {
    const cells: number[][][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => []));
    for (const x of perf) cells[x.wd][x.hour].push(x.value);
    return cells;
  }, [perf]);
  const byHour = Array.from({ length: 24 }, (_, h) => perf.filter((x) => x.hour === h).map((x) => x.value));
  const byDay = Array.from({ length: 7 }, (_, d) => perf.filter((x) => x.wd === d).map((x) => x.value));
  const cellVal = grid.map((row) => row.map((vals) => (vals.length ? agg(vals) : null)));
  const maxCell = Math.max(1, ...cellVal.flat().filter((v): v is number => v != null));
  const hourVal = byHour.map((v) => (v.length ? agg(v) : 0));
  const dayVal = byDay.map((v) => (v.length ? agg(v) : 0));

  const best = useMemo(() => {
    const slots: { wd: number; hour: number; v: number; n: number }[] = [];
    grid.forEach((row, wd) => row.forEach((vals, hour) => vals.length >= MIN_N && slots.push({ wd, hour, v: agg(vals), n: vals.length })));
    return slots.sort((a, c) => c.v - a.v).slice(0, 5);
  }, [grid, agg]);
  const bestHour = hourVal.reduce((bi, v, i) => (byHour[i].length >= MIN_N && v > (byHour[bi]?.length >= MIN_N ? hourVal[bi] : -1) ? i : bi), 0);
  const bestDay = dayVal.reduce((bi, v, i) => (byDay[i].length >= MIN_N && v > (byDay[bi]?.length >= MIN_N ? dayVal[bi] : -1) ? i : bi), 0);
  const overall = agg(perf.map((x) => x.value));
  const fmt = (n: number) => (metric === "revenue" ? usd(n) : metric === "followers" ? num(Math.round(n)) : compact(n));
  const metricLabel = metric === "views" ? `วิว ${windowDays} วันแรก` : metric === "revenue" ? `รายได้ ${windowDays} วันแรก` : "ผู้ติดตามจากโพสต์";
  const statLabel = stat === "median" ? "มัธยฐาน" : "ค่าเฉลี่ย";
  const lift = (v: number) => (overall ? ((v - overall) / overall) * 100 : 0);

  const cellPosts = cell ? perf.filter((x) => (cell.wd == null || x.wd === cell.wd) && (cell.hour == null || x.hour === cell.hour)).sort((a, c) => c.value - a.value) : [];
  const cellTitle = cell ? `${cell.wd != null ? `วัน${DAY_NAMES[cell.wd]}` : "ทุกวัน"}${cell.hour != null ? ` · ${hh(cell.hour)}–${hh((cell.hour + 1) % 24)}` : ""}` : "";

  return (
    <div className="fade-in mx-auto max-w-[1280px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">เวลาโพสต์</h1>
          <p className="mt-1 text-sm text-muted">
            โพสต์ช่วงไหนได้ผลดี · โพสต์ระหว่าง {thDay(win.from)} – {thDay(win.to)} · เวลาไทย
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <RangePicker value={range.key} onChange={(r) => range.set({ r })} pickDay={range.pickDay} onPickDay={(d) => range.set({ d })} min={firstDay} max={lastDay} />
          <WeekdayFilter mask={range.mask} onChange={(w) => range.set({ w })} />
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" aria-label="วัดผลจาก">
          <button data-active={metric === "views"} onClick={() => setMetric("views")}>วิว</button>
          <button data-active={metric === "revenue"} onClick={() => setMetric("revenue")}>รายได้</button>
          <button data-active={metric === "followers"} onClick={() => setMetric("followers")}>ผู้ติดตาม</button>
        </div>
        {metric !== "followers" && (
          <div className="seg" aria-label="ช่วงหลังโพสต์">
            {[1, 3, 7].map((n) => <button key={n} data-active={windowDays === n} onClick={() => setWindowDays(n)}>{n} วันแรก</button>)}
          </div>
        )}
        <div className="seg" aria-label="วิธีคำนวณ">
          <button data-active={stat === "median"} onClick={() => setStat("median")}>มัธยฐาน</button>
          <button data-active={stat === "mean"} onClick={() => setStat("mean")}>ค่าเฉลี่ย</button>
        </div>
        <InfoTip text="มัธยฐาน = ค่ากลางของโพสต์ในช่วงนั้น ไม่ถูกคลิปไวรัลตัวเดียวดึงขึ้น เหมาะกับการเลือกเวลาโพสต์มากกว่าค่าเฉลี่ย" side="bottom" align="center" />
        <select className="input ml-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="ประเภทโพสต์">
          <option value="all">ทุกประเภท</option>
          {["reel", "video", "photo", "text", "link"].map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </div>

      <PostingLog b={b} from={win.from} to={win.to} lastDay={lastDay} allow={range.allow} metric={metric} windowDays={windowDays}
        typeFilter={type} median={median(perf.map((x) => x.value))} fmt={fmt} metricLabel={metricLabel} title={title} />

      {perf.length < 3 ? (
        <div className="card"><EmptyState title="โพสต์ในช่วงนี้ยังน้อยเกินไป" hint={`ต้องมีโพสต์ที่อายุครบ ${windowDays} วันอย่างน้อย 3 โพสต์ ลองเลือกช่วง "ทั้งหมด" หรือ 1 วันแรก`} /></div>
      ) : (
        <>
          {/* summary */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { icon: Clock, label: "ชั่วโมงที่ดีที่สุด", value: `${hh(bestHour)}–${hh((bestHour + 1) % 24)}`, sub: `${statLabel} ${fmt(hourVal[bestHour])} · ${byHour[bestHour].length} โพสต์`, onClick: () => setCell({ hour: bestHour }) },
              { icon: CalendarDays, label: "วันที่ดีที่สุด", value: `วัน${DAY_NAMES[bestDay]}`, sub: `${statLabel} ${fmt(dayVal[bestDay])} · ${byDay[bestDay].length} โพสต์`, onClick: () => setCell({ wd: bestDay }) },
              { icon: Trophy, label: "ช่วงเวลาอันดับ 1", value: best[0] ? `${WEEKDAY_LABELS[best[0].wd]} ${hh(best[0].hour)}` : "–", sub: best[0] ? `${fmt(best[0].v)} · ${lift(best[0].v) >= 0 ? "+" : ""}${lift(best[0].v).toFixed(0)}% จากปกติ` : `ต้องมี ${MIN_N}+ โพสต์ต่อช่อง`, onClick: best[0] ? () => setCell({ wd: best[0].wd, hour: best[0].hour }) : undefined },
              { icon: Sparkles, label: `${statLabel}ทุกโพสต์`, value: fmt(overall), sub: `จาก ${num(perf.length)} โพสต์ · ${metricLabel}` },
            ].map((k) => (
              <button key={k.label} onClick={k.onClick} disabled={!k.onClick}
                className="card p-4 text-left transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:border-line-strong enabled:hover:shadow-[var(--shadow-pop)] disabled:cursor-default disabled:opacity-100">
                <div className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-muted"><k.icon size={15} className="text-primary-text" />{k.label}</div>
                <div className="num mt-3 truncate text-[22px] font-semibold leading-none tracking-tight sm:text-[24px]">{k.value}</div>
                <div className="mt-2 truncate text-xs text-muted">{k.sub}</div>
              </button>
            ))}
          </section>

          {/* heatmap */}
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">วัน × ชั่วโมงที่โพสต์</div>
                <div className="mt-0.5 text-xs text-muted">{statLabel}{metricLabel}ต่อโพสต์ · กดช่องเพื่อดูโพสต์ในช่วงนั้น</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                น้อย
                <span className="flex h-2.5 w-28 overflow-hidden rounded-full">
                  {[0.08, 0.25, 0.45, 0.65, 0.85, 1].map((a) => <span key={a} className="h-full flex-1" style={{ background: `color-mix(in srgb, var(--color-primary) ${a * 100}%, var(--color-subtle))` }} />)}
                </span>
                มาก
              </div>
            </div>
            <div className="overflow-x-auto px-4 pb-4 pt-3">
              <div className="grid min-w-[720px] gap-[3px]" style={{ gridTemplateColumns: "40px repeat(24, minmax(0, 1fr))" }} role="grid" aria-label="วัน × ชั่วโมง">
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="num pb-1 text-center text-[10px] font-medium text-muted">{String(h).padStart(2, "0")}</span>
                ))}
                {cellVal.map((row, wd) => [
                  <span key={`l${wd}`} className={`flex items-center text-xs font-medium ${range.mask[wd] === "1" ? "text-text" : "text-faint line-through"}`}>{WEEKDAY_LABELS[wd]}</span>,
                  ...row.map((v, h) => {
                    const n = grid[wd][h].length;
                    const a = v == null ? 0 : Math.max(0.1, v / maxCell);
                    const isBest = best.some((x) => x.wd === wd && x.hour === h);
                    return (
                      <button key={`${wd}-${h}`} disabled={!n} onClick={() => setCell({ wd, hour: h })} role="gridcell"
                        title={n ? `${DAY_NAMES[wd]} ${hh(h)} · ${statLabel} ${fmt(v ?? 0)} · ${n} โพสต์` : `${DAY_NAMES[wd]} ${hh(h)} · ไม่มีโพสต์`}
                        className={`num relative flex h-8 items-center justify-center rounded-md text-[10px] font-semibold transition-shadow hover:ring-2 hover:ring-primary/60 disabled:cursor-default disabled:hover:ring-0 ${
                          isBest ? "ring-2 ring-text/70" : ""} ${a > 0.55 ? "text-primary-ink" : "text-muted"}`}
                        style={{ background: n ? `color-mix(in srgb, var(--color-primary) ${a * 100}%, var(--color-subtle))` : "var(--color-subtle)", opacity: n && n < MIN_N ? 0.55 : 1 }}>
                        {n > 0 ? n : ""}
                      </button>
                    );
                  }),
                ])}
              </div>
              <p className="mt-2 text-[11px] text-muted">ตัวเลขในช่อง = จำนวนโพสต์ · ช่องจาง = มีโพสต์น้อยกว่า {MIN_N} ไม่นำมาจัดอันดับ · กรอบเข้ม = 5 ช่วงที่ดีที่สุด</p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {/* by hour */}
            <section className="card min-w-0">
              <div className="card-header"><div className="card-title">ตามชั่วโมงที่โพสต์</div><span className="text-xs text-muted">{statLabel}{metricLabel}</span></div>
              <Bars values={hourVal} counts={byHour.map((v) => v.length)} labels={Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))}
                best={bestHour} fmt={fmt} onPick={(i) => setCell({ hour: i })} />
            </section>
            {/* by weekday */}
            <section className="card min-w-0">
              <div className="card-header"><div className="card-title">ตามวันที่โพสต์</div></div>
              <Bars values={dayVal} counts={byDay.map((v) => v.length)} labels={WEEKDAY_LABELS} best={bestDay} fmt={fmt} onPick={(i) => setCell({ wd: i })} />
            </section>
          </div>

          {/* top slots */}
          <section className="card">
            <div className="card-header"><div className="card-title">5 ช่วงเวลาที่ได้ผลดีที่สุด</div><span className="text-xs text-muted">นับเฉพาะช่วงที่มี {MIN_N}+ โพสต์</span></div>
            {best.length ? (
              <ol className="divide-y divide-line">
                {best.map((s, i) => (
                  <li key={`${s.wd}-${s.hour}`}>
                    <button onClick={() => setCell({ wd: s.wd, hour: s.hour })} className="group flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-hover">
                      <span className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${i === 0 ? "bg-primary text-primary-ink" : "bg-primary-soft text-primary-text"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">วัน{DAY_NAMES[s.wd]} · {hh(s.hour)}–{hh((s.hour + 1) % 24)}</div>
                        <div className="text-xs text-muted">{s.n} โพสต์</div>
                      </div>
                      <div className="text-right">
                        <div className="num text-sm font-semibold">{fmt(s.v)}</div>
                        <div className={`num text-xs ${lift(s.v) >= 0 ? "text-up" : "text-down"}`}>{lift(s.v) >= 0 ? "+" : ""}{lift(s.v).toFixed(0)}% จากปกติ</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            ) : <EmptyState title="ยังไม่มีช่วงเวลาที่มีโพสต์มากพอ" hint={`แต่ละช่วงต้องมีอย่างน้อย ${MIN_N} โพสต์ ลองเลือกช่วง "ทั้งหมด"`} />}
          </section>
        </>
      )}

      <p className="text-xs leading-relaxed text-muted">
        เวลาโพสต์เป็นเวลาไทย · "{windowDays} วันแรก" นับวิว/รายได้ตั้งแต่วันที่โพสต์ (ตามวันของ Meta) และไม่รวมโพสต์ที่อายุยังไม่ครบ ·
        ผู้ติดตามเป็นยอดรวมตลอดอายุโพสต์ · ผลนี้บอกความสัมพันธ์จากข้อมูลในอดีต ไม่ใช่การรับประกันผล
      </p>

      <Drawer open={!!cell} onClose={() => setCell(null)} title={`โพสต์ช่วง ${cellTitle}`}
        subtitle={`${cellPosts.length} โพสต์ · ${statLabel} ${fmt(agg(cellPosts.map((x) => x.value)))} · ${metricLabel}`}
        icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text"><Clock size={18} /></span>}>
        {cellPosts.length ? (
          <ol className="divide-y divide-line">
            {cellPosts.map((x, i) => (
              <li key={x.key}>
                <Link href={`/p/${b.page.id}/post/${x.key}`} onClick={() => setCell(null)} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover">
                  <span className="num w-5 text-center text-xs font-semibold text-faint">{i + 1}</span>
                  <Thumb src={x.p.picture} type={x.p.type} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[13px] leading-snug group-hover:text-primary-text">{title(x.key, x.p)}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><TypeBadge type={x.p.type} />{thDate(x.p.createdTime)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm font-semibold">{fmt(x.value)}</div>
                    {metric !== "views" && <div className="num text-[11px] text-muted">{compact(x.views)} วิว</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        ) : <EmptyState title="ไม่มีโพสต์ในช่วงนี้" />}
      </Drawer>
    </div>
  );
}

function Bars({ values, counts, labels, best, fmt, onPick }: {
  values: number[]; counts: number[]; labels: string[]; best: number; fmt: (n: number) => string; onPick: (i: number) => void;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="overflow-x-auto px-4 pb-4 pt-5">
      <div className={`flex h-48 items-stretch gap-1 ${values.length > 7 ? "min-w-[480px]" : ""}`}>
        {values.map((v, i) => (
          <button key={i} onClick={() => counts[i] && onPick(i)} disabled={!counts[i]}
            title={`${labels[i]} · ${fmt(v)} · ${counts[i]} โพสต์`}
            className="group flex min-w-[14px] flex-1 flex-col items-center gap-1 disabled:cursor-default">
            <span className="flex w-full flex-1 flex-col items-center justify-end gap-1">
              {counts[i] > 0 && values.length <= 7 && <span className="num text-[10px] font-semibold text-text">{fmt(v)}</span>}
              <span className={`w-full rounded-t-md transition-[height,background-color] duration-300 ${
                i === best ? "bg-primary" : counts[i] ? "bg-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-subtle))] group-hover:bg-[color-mix(in_srgb,var(--color-primary)_60%,var(--color-subtle))]" : "bg-subtle"}`}
                style={{ height: `${counts[i] ? Math.max(3, (v / max) * 100) : 2}%` }} />
            </span>
            <span className={`num text-[10px] ${i === best ? "font-semibold text-text" : "text-muted"}`}>{labels[i]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Daily posting log (calendar / list) ---------------- */

type LogPost = { key: string; p: PostInfo; date: string; time: string; value: number; views: number; rev: number; complete: boolean; ageDays: number };
type Rating = { label: string; cls: string; dot: string };
const RATINGS = {
  great: { label: "ดีมาก", cls: "bg-up text-white", dot: "bg-up" },
  good: { label: "ดี", cls: "bg-up-soft text-up", dot: "bg-up/60" },
  normal: { label: "ปกติ", cls: "bg-subtle text-muted", dot: "bg-faint/50" },
  low: { label: "ต่ำ", cls: "bg-down-soft text-down", dot: "bg-down" },
  pending: { label: "ยังไม่ครบ", cls: "bg-primary-soft text-primary-text", dot: "bg-primary" },
} satisfies Record<string, Rating>;
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** Bangkok calendar date + HH:mm of a post. */
function bkk(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

function PostingLog({ b, from, to, lastDay, allow, metric, windowDays, typeFilter, median: med, fmt, metricLabel, title }: {
  b: PageBundle; from: string; to: string; lastDay: string; allow?: (d: string) => boolean; metric: Metric; windowDays: number;
  typeFilter: string; median: number; fmt: (n: number) => string; metricLabel: string; title: (k: string, p: PostInfo) => string;
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [openDay, setOpenDay] = useState<string | null>(null);

  const posts: LogPost[] = useMemo(() => {
    const out: LogPost[] = [];
    for (const [key, p] of Object.entries(b.posts)) {
      if (p.type === "story" || (typeFilter !== "all" && p.type !== typeFilter)) continue;
      const { date, time } = bkk(p.createdTime);
      if (date < from || date > addDays(to, 1)) continue;
      if (allow && !allow(date)) continue;
      const day0 = metaDay(p.createdTime);
      const end = addDays(day0, windowDays - 1);
      let v = 0, r = 0;
      for (let d = day0; d <= end && d <= lastDay; d = addDays(d, 1)) {
        v += b.postDaily[key]?.[d]?.v ?? 0;
        r += b.postDaily[key]?.[d]?.r ?? 0;
      }
      const ageDays = Math.max(0, Math.round((new Date(lastDay).getTime() - new Date(day0).getTime()) / 86400000));
      const value = metric === "views" ? v : metric === "revenue" ? r : b.latest[key]?.followersGained ?? 0;
      out.push({ key, p, date, time, value, views: v, rev: r, complete: metric === "followers" || end < lastDay, ageDays });
    }
    return out.sort((a, c) => (a.date + a.time < c.date + c.time ? 1 : -1));
  }, [b, from, to, lastDay, allow, metric, windowDays, typeFilter]);

  const rate = (x: LogPost): Rating => {
    if (!x.complete) return RATINGS.pending;
    if (!med) return RATINGS.normal;
    const k = x.value / med;
    return k >= 2 ? RATINGS.great : k >= 1.2 ? RATINGS.good : k >= 0.8 ? RATINGS.normal : RATINGS.low;
  };
  const byDate = useMemo(() => {
    const m = new Map<string, LogPost[]>();
    for (const x of posts) m.set(x.date, [...(m.get(x.date) ?? []), x]);
    for (const list of m.values()) list.sort((a, c) => a.time.localeCompare(c.time));
    return m;
  }, [posts]);

  // calendar month navigation (defaults to the month of the newest post in range)
  const newest = posts[0]?.date ?? to;
  const [month, setMonth] = useState(newest.slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const minMonth = (posts.at(-1)?.date ?? from).slice(0, 7);
  const maxMonth = newest.slice(0, 7);
  const dayPosts = openDay ? byDate.get(openDay) ?? [] : [];
  const dayLabel = (d: string) => {
    const [yy, mm, dd] = d.split("-").map(Number);
    const wd = (new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay() + 6) % 7;
    return `วัน${DAY_NAMES[wd]} ${dd} ${TH_MONTHS[mm - 1]} ${yy + 543}`;
  };
  const Badge = ({ x }: { x: LogPost }) => {
    const r = rate(x);
    return <span className={`badge ${r.cls}`}>{r === RATINGS.pending ? `ยังไม่ครบ ${windowDays} วัน` : r.label}</span>;
  };

  const PostRow = ({ x }: { x: LogPost }) => (
    <Link href={`/p/${b.page.id}/post/${x.key}`} onClick={() => setOpenDay(null)}
      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover">
      <span className="num w-12 shrink-0 text-sm font-semibold">{x.time}</span>
      <Thumb src={x.p.picture} type={x.p.type} size={44} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium group-hover:text-primary-text">{title(x.key, x.p)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <Badge x={x} /><TypeBadge type={x.p.type} />
          {x.rev >= 0.005 && <span className="num text-up">{usd(x.rev)}</span>}
        </div>
      </div>
      <div className="w-20 shrink-0 text-right">
        <div className="num text-sm font-semibold">{fmt(x.value)}</div>
        <div className="text-[11px] text-muted">{med && x.complete ? `${(x.value / med).toFixed(1)}× ปกติ` : metric === "views" ? `${Math.min(windowDays, x.ageDays + 1)} วัน` : ""}</div>
      </div>
    </Link>
  );

  return (
    <section className="card">
      <div className="card-header">
        <div className="min-w-0">
          <div className="card-title">บันทึกการโพสต์รายวัน</div>
          <div className="mt-0.5 text-xs text-muted">{num(posts.length)} โพสต์ · เทียบกับปกติ (มัธยฐาน {fmt(med)}) · {metricLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-[11px] text-muted md:flex">
            {[RATINGS.great, RATINGS.good, RATINGS.normal, RATINGS.low].map((r) => (
              <span key={r.label} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${r.dot}`} />{r.label}</span>
            ))}
          </div>
          <div className="seg">
            <button data-active={view === "calendar"} onClick={() => setView("calendar")}>ปฏิทิน</button>
            <button data-active={view === "list"} onClick={() => setView("list")}>รายการ</button>
          </div>
        </div>
      </div>

      {!posts.length ? (
        <EmptyState title="ไม่มีโพสต์ในช่วงนี้" hint="ลองเลือกช่วง &quot;ทั้งหมด&quot; หรือเปลี่ยนตัวกรองวัน/ประเภท" />
      ) : view === "calendar" ? (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button className="btn btn-icon h-8 w-8" disabled={month <= minMonth} onClick={() => shiftMonth(-1)} aria-label="เดือนก่อน">‹</button>
            <div className="text-sm font-semibold">{TH_MONTHS[m - 1]} <span className="num">{y + 543}</span></div>
            <button className="btn btn-icon h-8 w-8" disabled={month >= maxMonth} onClick={() => shiftMonth(1)} aria-label="เดือนถัดไป">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((l) => <div key={l} className="pb-1 text-center text-[11px] font-medium text-muted">{l}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const list = byDate.get(d) ?? [];
              const dimmed = (allow && !allow(d)) || d < from || d > to;
              const top = list.length ? Math.max(...list.map((x) => x.value)) : 0;
              return (
                <button key={d} onClick={() => list.length && setOpenDay(d)} disabled={!list.length}
                  className={`flex min-h-[92px] flex-col rounded-xl border p-1.5 text-left transition sm:p-2 ${
                    list.length ? "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-pop)]" : "border-transparent bg-subtle/60"} ${dimmed ? "opacity-40" : ""} disabled:cursor-default`}>
                  <div className="flex items-center justify-between">
                    <span className={`num text-xs font-semibold ${d === lastDay ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-ink" : "text-muted"}`}>{Number(d.slice(8))}</span>
                    {list.length > 0 && <span className="num hidden text-[10px] text-muted sm:inline">{fmt(top)}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {list.slice(0, 4).map((x) => {
                      const r = rate(x);
                      return (
                        <span key={x.key} title={`${x.time} · ${fmt(x.value)} · ${r.label}`}
                          className={`num inline-flex items-center rounded-md px-1 py-0.5 text-[10px] font-semibold leading-none sm:px-1.5 ${r.cls}`}>
                          {x.time}
                        </span>
                      );
                    })}
                    {list.length > 4 && <span className="num text-[10px] text-muted">+{list.length - 4}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="max-h-[640px] overflow-y-auto">
          {[...byDate.entries()].map(([d, list]) => (
            <div key={d}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-y border-line bg-subtle px-5 py-2 text-xs">
                <span className="font-semibold text-text">{dayLabel(d)}</span>
                <span className="text-muted">{list.length} โพสต์ · ยอดดูเพจวันนั้น {compact(b.pageDaily[d]?.mediaViews ?? 0)}</span>
              </div>
              <div className="divide-y divide-line">{list.map((x) => <PostRow key={x.key} x={x} />)}</div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? dayLabel(openDay) : ""}
        subtitle={openDay ? `${dayPosts.length} โพสต์ · ยอดดูเพจวันนั้น ${num(b.pageDaily[openDay]?.mediaViews ?? 0)} · วิดีโอวิว ${num(b.pageDaily[openDay]?.videoViews ?? 0)}` : ""}
        icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text"><CalendarDays size={18} /></span>}
        footer={`ผลลัพธ์ = ${metricLabel} เทียบกับมัธยฐานของทุกโพสต์ในช่วงที่เลือก (${fmt(med)}) · ดีมาก ≥ 2× · ดี ≥ 1.2× · ต่ำ < 0.8×`}>
        <div className="divide-y divide-line">{dayPosts.map((x) => <PostRow key={x.key} x={x} />)}</div>
      </Drawer>
    </section>
  );
}
