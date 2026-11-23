import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, LabelList, Line, Tooltip, XAxis, YAxis } from "recharts";
import { compact, thDay } from "@/lib/format";

export type Series = {
  key: string;
  label: string;
  kind: "bar" | "line" | "area" | "ghost";
  color: string;
  axis?: "left" | "right";
  format?: (n: number) => string;
  /** Print the value of every point on the chart (no hover needed). */
  labels?: boolean;
};

const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** Width given to each day. Every day keeps its date and value label; long ranges scroll horizontally. */
const PX_PER_DAY = 48;
const AXIS_W = 48;
const X_AXIS_H = 34;
/** `fit` mode: below these widths per day, value labels turn vertical / date numbers shrink / text is thinned out. */
const FIT_ROTATE = 36;
const FIT_SMALL = 17;
const FIT_THIN = 9.5;

/** Invisible series that carries the value labels above every other mark. */
const LABEL_LAYER = "__labels";
const fitFont = (perDay: number, normal: number) => (perDay < 12 ? 8 : perDay < FIT_SMALL ? 9 : normal);

function Tip({ active, payload, label, series, compare }: any) {
  if (!active || !payload?.length) return null;
  const cur = payload.find((p: any) => p.dataKey === "cur")?.value;
  const prev = payload.find((p: any) => p.dataKey === "prev")?.value;
  const change = compare && typeof cur === "number" && typeof prev === "number" && prev > 0 ? ((cur - prev) / prev) * 100 : null;
  return (
    <div className="min-w-[180px] rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-pop)]">
      <div className="mb-1.5 font-medium text-text">{thDay(String(label))}</div>
      {[...payload].sort((x: any, y: any) => (x.dataKey === "prev" ? 1 : 0) - (y.dataKey === "prev" ? 1 : 0)).map((p: any) => {
        const s: Series | undefined = series.find((x: Series) => x.key === p.dataKey);
        if (!s || p.value == null || p.name === LABEL_LAYER) return null;
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: s.kind === "ghost" ? "var(--color-faint)" : s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="num ml-auto pl-4 font-semibold text-text">{s.format ? s.format(p.value) : Number(p.value).toLocaleString()}</span>
          </div>
        );
      })}
      {change != null && (
        <div className={`num mt-1.5 border-t border-line pt-1.5 font-medium ${change >= 0 ? "text-up" : "text-down"}`}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% เทียบช่วงก่อน
        </div>
      )}
    </div>
  );
}

/** Round a max up to a "nice" number and return 4 even steps from 0. */
function niceScale(max: number) {
  if (!(max > 0)) return { top: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = (max * 1.08) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => +(i * step).toFixed(10)) };
}

/** Two-line date tick: day number, plus the month under the 1st of a month / first point. */
function DateTick({ x, y, payload, index, visibleTicksCount, size = 11, every = 1, near = 0 }: any) {
  const [yy, m, d] = String(payload.value).split("-").map(Number);
  // month under the 1st, the 15th and both ends, so a scrolled view always has context
  // (an end is skipped when the next 1st/15th is closer than `near` days, so the names never collide)
  const toNext = d < 15 ? 15 - d : new Date(Date.UTC(yy, m, 0)).getUTCDate() - d + 1;
  const fromPrev = d < 15 ? d - 1 : d - 15;
  const showMonth = d === 1 || d === 15 || (index === 0 && toNext >= near) || (index === visibleTicksCount - 1 && fromPrev >= near);
  const showDay = (visibleTicksCount - 1 - index) % every === 0;
  return (
    <g transform={`translate(${x},${y})`}>
      {showDay && <text dy={12} textAnchor="middle" fontSize={size} fill="var(--color-muted)" style={{ fontFamily: "var(--font-num)" }}>{d}</text>}
      {showMonth && <text dy={26} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--color-text)">{TH_SHORT[m - 1]}</text>}
    </g>
  );
}

export function DailyChart({ data, series, height = 280, compare, fit }: {
  data: Record<string, any>[]; series: Series[]; height?: number; compare?: boolean;
  /** Squeeze every day into the visible width instead of scrolling. */
  fit?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const hasRight = series.some((s) => s.axis === "right");
  const hasLabels = series.some((s) => s.labels);
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const viewW = Math.max(0, boxW - AXIS_W - (hasRight ? AXIS_W : 0));
  const need = data.length * PX_PER_DAY + 48;
  // a few px of overflow isn't worth a scrollbar: squeeze instead
  const contentW = fit || need - viewW < 80 ? viewW : need;
  const margin = fit ? 8 : 24;
  const perDay = fit && viewW ? (viewW - margin * 2) / Math.max(1, data.length) : PX_PER_DAY;
  const rotate = perDay < FIT_ROTATE;
  const every = perDay < FIT_THIN ? Math.ceil(FIT_THIN / perDay) : 1; // only on very narrow screens
  const top = hasLabels ? (rotate ? 46 : 26) : 10;
  const scrolls = contentW > viewW + 1;

  // start at the latest day (right edge) once the chart has its real width
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !boxW) return;
    const id = requestAnimationFrame(() => (el.scrollLeft = el.scrollWidth));
    return () => cancelAnimationFrame(id);
  }, [boxW, contentW, data.length]);

  const scaleFor = (axis: "left" | "right") => {
    const vals = series.filter((s) => (s.axis ?? "left") === axis).flatMap((s) => data.map((d) => Number(d[s.key]) || 0));
    return niceScale(Math.max(0, ...vals));
  };
  const left = scaleFor("left");
  const right = hasRight ? scaleFor("right") : null;
  const rightFmt = series.find((s) => s.axis === "right")?.format ?? compact;
  const plotH = height - top - X_AXIS_H;

  const valueLabel = (s: Series) =>
    s.labels ? (
      <LabelList dataKey={s.key} content={(p: any) => {
        const { x, y, width, value } = p;
        if (value == null || value === 0) return null;
        const cx = Number(x) + (width ? Number(width) / 2 : 0);
        if (rotate && (data.length - 1 - p.index) % every !== 0) return null;
        return (
          <text x={cx} y={Number(y) - (rotate ? 5 : 9)} textAnchor={rotate ? "start" : "middle"} fontSize={rotate ? fitFont(perDay, 10.5) : 10.5}
            {...(rotate ? { transform: `rotate(-90 ${cx} ${Number(y) - 5})`, dominantBaseline: "central" } : {})} fontWeight={600} fill="var(--color-text)"
            style={{ fontFamily: "var(--font-num)", paintOrder: "stroke", stroke: "var(--color-surface)", strokeWidth: 4, strokeLinejoin: "round" }}>
            {s.format ? s.format(Number(value)) : compact(Number(value))}
          </text>
        );
      }} />
    ) : null;

  const AxisCol = ({ scale, fmt, side }: { scale: { top: number; ticks: number[] }; fmt: (n: number) => string; side: "left" | "right" }) => (
    <div className="relative shrink-0" style={{ width: AXIS_W, height }} aria-hidden>
      {scale.ticks.map((t) => (
        <span key={t} className={`num absolute text-[11px] leading-none text-muted ${side === "left" ? "right-2" : "left-2"}`}
          style={{ top: top + plotH - (t / scale.top) * plotH - 5 }}>
          {fmt(t)}
        </span>
      ))}
    </div>
  );

  return (
    <div ref={box} className="relative flex w-full" style={{ height }}>
      <AxisCol scale={left} fmt={(n) => compact(n)} side="left" />
      <div ref={scroller} className={`min-w-0 flex-1 ${scrolls ? "overflow-x-auto overscroll-x-contain" : "overflow-hidden"}`}>
        {boxW > 0 && (
          <ComposedChart width={contentW} height={height} data={data} margin={{ top, right: margin, bottom: 0, left: margin }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.kind === "bar" ? 0.9 : 0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={s.kind === "bar" ? 0.55 : 0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="day" interval={0} tick={<DateTick size={fitFont(perDay, 11)} every={every} near={fit ? Math.min(data.length - 1, Math.ceil(32 / perDay)) : 0} />} tickLine={false} axisLine={false} height={X_AXIS_H} />
            <YAxis yAxisId="left" hide domain={[0, left.top]} ticks={left.ticks} />
            {right && <YAxis yAxisId="right" orientation="right" hide domain={[0, right.top]} ticks={right.ticks} />}
            <Tooltip content={<Tip series={series} compare={compare} />} allowEscapeViewBox={{ x: false, y: true }}
              cursor={{ stroke: "var(--color-faint)", strokeWidth: 1, strokeDasharray: "3 3", fill: "var(--color-hover)" }} />
            {series.map((s) => {
              const common = { dataKey: s.key, name: s.label, yAxisId: s.axis ?? "left", isAnimationActive: s.kind !== "ghost" && !scrolls && !fit, animationDuration: 450, animationEasing: "ease-out" as const };
              if (s.kind === "bar") return <Bar key={s.key} {...common} fill={`url(#${uid}-${s.key})`} radius={[5, 5, 0, 0]} maxBarSize={26}>{fit ? null : valueLabel(s)}</Bar>;
              if (s.kind === "area")
                return <Area key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2} fill={`url(#${uid}-${s.key})`} dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)", fill: s.color }} connectNulls>{valueLabel(s)}</Area>;
              if (s.kind === "ghost")
                return <Line key={s.key} {...common} type="monotone" stroke="var(--color-faint)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} connectNulls />;
              return <Line key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2} dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)", fill: s.color }} connectNulls>{valueLabel(s)}</Line>;
            })}
            {fit && series.filter((s) => s.kind === "bar" && s.labels).map((s) => (
              <Line key={`labels-${s.key}`} dataKey={s.key} name={LABEL_LAYER} yAxisId={s.axis ?? "left"} stroke="none" dot={false} activeDot={false} isAnimationActive={false} legendType="none">{valueLabel(s)}</Line>
            ))}
          </ComposedChart>
        )}
      </div>
      {right && <AxisCol scale={right} fmt={rightFmt} side="right" />}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden><line x1="0" y1="3" x2="16" y2="3" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dashed ? "3 3" : undefined} strokeLinecap="round" /></svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}
