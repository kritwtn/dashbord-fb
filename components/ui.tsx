import { AlertTriangle, ArrowDownRight, ArrowUpRight, Inbox, Info, RotateCw } from "lucide-react";
import { RANGES, type RangeKey } from "@/lib/range";
import { TYPE_LABEL } from "@/lib/format";
import { DatePicker } from "./DatePicker";

export const Dash = () => <span className="text-faint">–</span>;

/** Growth vs previous period. Negative uses slate (no red). */
export function Growth({ g, pill, size = "sm" }: { g: number | null | undefined; pill?: boolean; size?: "sm" | "xs" }) {
  if (g === undefined) return pill ? null : <Dash />;
  if (g === null) return <span className="badge bg-primary-soft text-primary-text">ใหม่</span>;
  const up = g > 0, down = g < 0;
  const val = `${Math.abs(g).toFixed(g !== 0 && Math.abs(g) < 10 ? 1 : 0)}%`;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const cls = up ? "text-up" : down ? "text-down" : "text-muted";
  if (pill)
    return (
      <span className={`badge num ${up ? "bg-up-soft" : "bg-down-soft"} ${cls}`}>
        {g !== 0 && <Icon size={12} strokeWidth={2.5} />}{val}
      </span>
    );
  return (
    <span className={`num inline-flex items-center gap-0.5 ${size === "xs" ? "text-xs" : "text-sm"} ${cls}`}>
      {g !== 0 && <Icon size={size === "xs" ? 12 : 14} strokeWidth={2.5} />}{val}
    </span>
  );
}

export function RangePicker({ value, onChange, pickDay, onPickDay, min, max }: {
  value: RangeKey; onChange: (k: RangeKey) => void; pickDay: string; onPickDay: (d: string) => void; min: string; max: string;
}) {
  return (
    <div className="flex w-full min-w-0 max-w-full items-center gap-2 sm:w-auto">
      <div className="relative min-w-0 max-w-full">
        <div className="seg no-scrollbar max-w-full overflow-x-auto">
          {RANGES.map((r) => (
            <button key={r.key} data-active={value === r.key} onClick={() => onChange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>
      {value === "day" && (
        <div className="shrink-0"><DatePicker value={pickDay} onChange={onPickDay} min={min} max={max} align="right" /></div>
      )}
    </div>
  );
}

const TYPE_STYLE: Record<string, string> = {
  reel: "bg-primary-soft text-primary-text",
  video: "bg-primary-soft text-primary-text",
  photo: "bg-[color-mix(in_srgb,var(--color-c2)_14%,transparent)] text-[var(--color-c2)]",
  text: "bg-subtle text-muted",
  link: "bg-[color-mix(in_srgb,var(--color-c3)_14%,transparent)] text-[var(--color-c3)]",
  story: "bg-[color-mix(in_srgb,var(--color-c6)_14%,transparent)] text-[var(--color-c6)]",
  other: "bg-subtle text-muted",
};
export const TypeBadge = ({ type }: { type: string }) => <span className={`badge ${TYPE_STYLE[type] ?? TYPE_STYLE.other}`}>{TYPE_LABEL[type] ?? type}</span>;

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-faint"><Inbox size={20} /></span>
      <div className="mt-3 text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 max-w-xs text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SortHeader({ label, active, dir, onSort, align = "left" }: {
  label: string; active: boolean; dir: "asc" | "desc"; onSort: (d: "asc" | "desc") => void; align?: "left" | "right";
}) {
  return (
    <button onClick={() => onSort(active && dir === "desc" ? "asc" : "desc")}
      className={`group inline-flex items-center gap-1 whitespace-nowrap rounded px-1 -mx-1 transition-colors hover:text-text ${active ? "text-text" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} title="กดเพื่อสลับ น้อย→มาก / มาก→น้อย">
      {label}
      <span className={`inline-flex flex-col text-[8px] leading-[8px] ${active ? "" : "opacity-0 group-hover:opacity-60"}`}>
        <span className={active && dir === "asc" ? "text-primary-text" : "text-faint"}>▲</span>
        <span className={active && dir === "desc" ? "text-primary-text" : "text-faint"}>▼</span>
      </span>
    </button>
  );
}

/** Small ⓘ with an accessible tooltip (hover or keyboard focus). */
export function InfoTip({ text, side = "top", align = "end" }: { text: React.ReactNode; side?: "top" | "bottom"; align?: "center" | "end" }) {
  return (
    <span className="group/tip relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <span tabIndex={0} role="img" aria-label="ข้อมูลเพิ่มเติม"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-faint outline-none transition-colors hover:text-text focus-visible:text-text">
        <Info size={13} />
      </span>
      <span role="tooltip"
        className={`pointer-events-none absolute z-50 hidden w-max max-w-[min(240px,80vw)] whitespace-normal rounded-lg bg-text px-2.5 py-1.5 text-xs font-normal leading-relaxed text-bg shadow-[var(--shadow-pop)] group-hover/tip:block group-focus-within/tip:block ${
          align === "end" ? "-right-1" : "left-1/2 -translate-x-1/2"} ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}>
        {text}
      </span>
    </span>
  );
}

export function ErrorState({ title = "โหลดข้อมูลไม่สำเร็จ", detail, onRetry }: { title?: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-down-soft text-down"><AlertTriangle size={20} /></span>
      <div className="mt-3 text-sm font-medium">{title}</div>
      {detail && <div className="mt-1 max-w-sm break-words text-xs text-muted">{detail}</div>}
      {onRetry && <button className="btn mt-4 h-8 text-[13px]" onClick={onRetry}><RotateCw size={14} />ลองอีกครั้ง</button>}
    </div>
  );
}
