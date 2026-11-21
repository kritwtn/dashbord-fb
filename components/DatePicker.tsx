import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const parse = (s: string) => s.split("-").map(Number) as [number, number, number];

/** "21 พ.ย. 2569" (Buddhist year) */
export const thDateLabel = (day: string) => {
  const [y, m, d] = parse(day);
  return `${d} ${TH_SHORT[m - 1]} ${y + 543}`;
};

/**
 * Popover calendar. Days outside [min, max] are disabled. Keyboard: Esc closes;
 * ← → move one day, ↑ ↓ one week while open.
 */
export function DatePicker({ value, onChange, min, max, size = "md", align = "left", label = "เลือกวัน" }: {
  value: string; onChange: (day: string) => void; min?: string; max?: string;
  size?: "sm" | "md"; align?: "left" | "right"; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [vy, vm] = parse(value);
  const [view, setView] = useState({ y: vy, m: vm - 1 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setView({ y: vy, m: vm - 1 }), [vy, vm]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      const d = new Date(value + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + step);
      const next = d.toISOString().slice(0, 10);
      if ((!min || next >= min) && (!max || next <= max)) onChange(next);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", keys);
    };
  }, [open, value, min, max, onChange]);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const daysIn = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const canPrev = !min || monthKey(view.y, view.m) > min.slice(0, 7);
  const canNext = !max || monthKey(view.y, view.m) < max.slice(0, 7);
  const shift = (n: number) => setView(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const today = max;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open} aria-label={label}
        className={`inline-flex items-center gap-2 rounded-[10px] border bg-surface font-medium text-text transition-colors hover:bg-hover ${
          open ? "border-primary ring-3 ring-primary/25" : "border-line"} ${size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-sm"}`}>
        <CalendarDays size={size === "sm" ? 14 : 15} className="text-muted" />
        <span className="num whitespace-nowrap">{thDateLabel(value)}</span>
      </button>

      {open && (
        <div role="dialog" aria-label={label}
          className={`absolute z-50 mt-2 w-[284px] rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-pop)] ${align === "right" ? "right-0" : "left-0"}`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-icon h-8 w-8" disabled={!canPrev} onClick={() => shift(-1)} aria-label="เดือนก่อน"><ChevronLeft size={16} /></button>
            <div className="text-sm font-semibold">{TH_MONTHS[view.m]} <span className="num">{view.y + 543}</span></div>
            <button type="button" className="btn btn-ghost btn-icon h-8 w-8" disabled={!canNext} onClick={() => shift(1)} aria-label="เดือนถัดไป"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {TH_DOW.map((d) => <div key={d} className="py-1 text-[11px] font-medium text-faint">{d}</div>)}
            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const k = key(view.y, view.m, d);
              const disabled = (!!min && k < min) || (!!max && k > max);
              const selected = k === value;
              return (
                <button type="button" key={i} disabled={disabled} onClick={() => { onChange(k); setOpen(false); }}
                  className={`num relative h-9 rounded-lg text-[13px] transition-colors ${
                    selected ? "bg-primary font-semibold text-primary-ink"
                      : disabled ? "text-faint/50"
                      : "text-text hover:bg-hover"}`}
                  aria-pressed={selected} aria-label={thDateLabel(k)}>
                  {d}
                  {k === today && !selected && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
          {max && (
            <div className="mt-2 flex justify-between border-t border-line pt-2">
              <button type="button" className="btn btn-ghost h-8 text-[13px]" onClick={() => { onChange(max); setOpen(false); }}>วันล่าสุด</button>
              <span className="self-center text-[11px] text-faint">มีข้อมูล {min ? thDateLabel(min) : ""} – {thDateLabel(max)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
