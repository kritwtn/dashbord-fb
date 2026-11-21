"use client";
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

function Tip({ active, payload, label, series }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <div className="mb-1 text-muted">{thDay(String(label))}</div>
      {payload.map((p: any) => {
        const s: Series | undefined = series.find((x: Series) => x.key === p.dataKey);
        if (!s || p.value == null) return null;
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: s.kind === "ghost" ? "var(--color-faint)" : s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="num ml-auto pl-4 font-semibold text-text">{s.format ? s.format(p.value) : Number(p.value).toLocaleString()}</span>
          </div>
        );
      })}
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
function DateTick({ x, y, payload, index, visibleTicksCount }: any) {
  const [, m, d] = String(payload.value).split("-").map(Number);
  // month under the 1st, the 15th and both ends, so a scrolled view always has context
  const showMonth = d === 1 || d === 15 || index === 0 || index === visibleTicksCount - 1;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fontSize={11} fill="var(--color-muted)" style={{ fontFamily: "var(--font-num)" }}>{d}</text>
      {showMonth && <text dy={26} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--color-text)">{TH_SHORT[m - 1]}</text>}
    </g>
  );
}

export function DailyChart({ data, series, height = 280 }: { data: Record<string, any>[]; series: Series[]; height?: number }) {
  const uid = useId().replace(/:/g, "");
  const hasRight = series.some((s) => s.axis === "right");
  const hasLabels = series.some((s) => s.labels);
  const top = hasLabels ? 26 : 10;
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
  const contentW = need - viewW < 80 ? viewW : need;
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
        return (
          <text x={cx} y={Number(y) - 9} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--color-text)"
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
          <ComposedChart width={contentW} height={height} data={data} margin={{ top, right: 24, bottom: 0, left: 24 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.kind === "bar" ? 0.9 : 0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={s.kind === "bar" ? 0.55 : 0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="day" interval={0} tick={<DateTick />} tickLine={false} axisLine={false} height={X_AXIS_H} />
            <YAxis yAxisId="left" hide domain={[0, left.top]} ticks={left.ticks} />
            {right && <YAxis yAxisId="right" orientation="right" hide domain={[0, right.top]} ticks={right.ticks} />}
            <Tooltip content={<Tip series={series} />} cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1, fill: "var(--color-hover)" }} />
            {series.map((s) => {
              const common = { key: s.key, dataKey: s.key, name: s.label, yAxisId: s.axis ?? "left", isAnimationActive: false };
              if (s.kind === "bar") return <Bar {...common} fill={`url(#${uid}-${s.key})`} radius={[5, 5, 0, 0]} maxBarSize={26}>{valueLabel(s)}</Bar>;
              if (s.kind === "area")
                return <Area {...common} type="monotone" stroke={s.color} strokeWidth={2} fill={`url(#${uid}-${s.key})`} dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)", fill: s.color }} connectNulls>{valueLabel(s)}</Area>;
              if (s.kind === "ghost")
                return <Line {...common} type="monotone" stroke="var(--color-faint)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} connectNulls />;
              return <Line {...common} type="monotone" stroke={s.color} strokeWidth={2} dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)", fill: s.color }} connectNulls>{valueLabel(s)}</Line>;
            })}
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
