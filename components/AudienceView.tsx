import { Globe2, Info, MapPin, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { AudienceDay } from "@/lib/data";
import { addDays, compact, daysBetween, num, thDay } from "@/lib/format";
import { countryName, flag, provinceOf } from "@/lib/geo";
import { computeWindow, useRangeParam } from "@/lib/range";
import { DailyChart, Legend } from "./DailyChart";
import { maskPage, useSecret } from "./Secret";
import { Sparkline } from "./Sparkline";
import { Dash, EmptyState, InfoTip, MetaDay, RangePicker, SortHeader } from "./ui";

type Mode = "country" | "province";
type Row = { key: string; label: string; icon?: string; total: number; base: number; change: number; share: number; series: number[] };
type SortKey = "label" | "total" | "change" | "share";

/** totals per key for one day, for the chosen mode */
function totalsOf(day: AudienceDay | undefined, mode: Mode): Map<string, { label: string; icon?: string; n: number }> {
  const m = new Map<string, { label: string; icon?: string; n: number }>();
  if (!day) return m;
  if (mode === "country") for (const [code, n] of day.country ?? []) m.set(code, { label: countryName(code), icon: flag(code), n });
  else
    for (const [city, n] of day.city ?? []) {
      const p = provinceOf(city);
      const cur = m.get(p.key);
      m.set(p.key, { label: p.label, icon: p.thai ? undefined : "🌏", n: (cur?.n ?? 0) + n });
    }
  return m;
}

export function AudienceView({ data, pageName, pageIndex }: { data: Record<string, AudienceDay>; pageName: string; pageIndex: number }) {
  const { on: secret } = useSecret();
  const days = useMemo(() => Object.keys(data).sort(), [data]);
  const firstDay = days[0] ?? new Date().toISOString().slice(0, 10);
  const lastDay = days.at(-1) ?? firstDay;
  const range = useRangeParam(lastDay);
  const win = computeWindow(range.key, firstDay, lastDay, range.pickDay);
  const [mode, setMode] = useState<Mode>("country");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [selected, setSelected] = useState<string | null>(null);

  // Meta repeats the last snapshot for the newest ~2 days: find the last day that actually changed
  const freshDay = useMemo(() => {
    for (let i = days.length - 1; i > 0; i--)
      if (JSON.stringify(data[days[i]].country) !== JSON.stringify(data[days[i - 1]].country)) return days[i];
    return lastDay;
  }, [data, days, lastDay]);

  const latestOnOrBefore = (d: string) => {
    let pick: string | undefined;
    for (const x of days) if (x <= d) pick = x;
    return pick;
  };
  const endDay = latestOnOrBefore(win.to);
  const baseDay = range.key === "all" ? undefined : latestOnOrBefore(addDays(win.from, -1));
  const seriesDays = useMemo(() => daysBetween(addDays(lastDay, -29), lastDay).filter((d) => d >= firstDay), [firstDay, lastDay]);

  const rows: Row[] = useMemo(() => {
    const end = totalsOf(endDay ? data[endDay] : undefined, mode);
    const base = totalsOf(baseDay ? data[baseDay] : undefined, mode);
    const perDay = seriesDays.map((d) => totalsOf(data[d], mode));
    const sum = [...end.values()].reduce((a, b) => a + b.n, 0) || 1;
    return [...end.entries()].map(([key, v]) => {
      const b = base.get(key)?.n ?? 0;
      return { key, label: v.label, icon: v.icon, total: v.n, base: b, change: v.n - b, share: v.n / sum, series: perDay.map((m) => m.get(key)?.n ?? 0) };
    });
  }, [data, endDay, baseDay, mode, seriesDays]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (sort.key === "label" ? a.label.localeCompare(b.label, "th") : (a[sort.key] as number) - (b[sort.key] as number)) * dir);
  }, [rows, sort]);

  const top = [...rows].sort((a, b) => b.total - a.total);
  const sel = rows.find((r) => r.key === selected) ?? top[0];
  const totalKnown = rows.reduce((a, r) => a + r.total, 0);
  const gained = rows.reduce((a, r) => a + r.change, 0);
  const th = mode === "country" ? rows.find((r) => r.key === "TH") : undefined;

  // trend for the selected row: daily gain (bars) + total (line)
  const chartDays = range.key === "all" ? days : daysBetween(addDays(win.to, -Math.max(13, win.len - 1)), win.to).filter((d) => d >= firstDay);
  const chart = chartDays.map((d) => {
    const t = sel ? totalsOf(data[d], mode).get(sel.key)?.n ?? null : null;
    const p = sel ? totalsOf(data[latestOnOrBefore(addDays(d, -1)) ?? ""], mode).get(sel.key)?.n ?? null : null;
    return { day: d, total: t, gain: t != null && p != null ? Math.max(0, t - p) : null };
  });

  if (!days.length)
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
        <div className="card"><EmptyState title="ยังไม่มีข้อมูลผู้ติดตาม" hint="กด Sync เพื่อดึงข้อมูลผู้ติดตามตามประเทศและจังหวัด" /></div>
      </div>
    );

  const th_ = (k: SortKey, label: string, align: "left" | "right" = "right") => (
    <SortHeader label={label} align={align} active={sort.key === k} dir={sort.dir} onSort={(dir) => setSort({ key: k, dir })} />
  );

  return (
    <div className="fade-in mx-auto max-w-[1280px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">ผู้ติดตาม</h1>
          <p className="mt-1 text-sm text-muted">
            {maskPage(secret, pageName, pageIndex)} · ข้อมูล Meta อัปเดตล่าสุด <span className="whitespace-nowrap font-medium text-text">{thDay(freshDay)}</span>
          </p>
        </div>
        <RangePicker value={range.key} onChange={(r) => range.set({ r })} pickDay={range.pickDay} onPickDay={(d) => range.set({ d })} min={firstDay} max={lastDay} />
      </div>

      {/* summary */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { icon: Users, label: mode === "country" ? "ผู้ติดตามที่ระบุประเทศได้" : "ผู้ติดตามใน 45 เมืองแรก", value: num(totalKnown),
            sub: range.key === "all" ? "ทั้งหมด" : `${gained >= 0 ? "+" : ""}${num(gained)} ในช่วงนี้`,
            help: mode === "country" ? "Meta นับเฉพาะผู้ติดตามที่ระบุประเทศได้ จึงอาจน้อยกว่ายอดผู้ติดตามรวมเล็กน้อย" : "Meta ให้ข้อมูลเฉพาะ 45 เมืองที่มีผู้ติดตามมากที่สุด" },
          { icon: Globe2, label: mode === "country" ? "จำนวนประเทศ" : "จำนวนจังหวัด/เมือง", value: num(rows.length), sub: mode === "country" ? `ต่างประเทศ ${num(totalKnown - (th?.total ?? 0))} คน` : "รวมอำเภอเป็นจังหวัดแล้ว" },
          { icon: MapPin, label: "อันดับ 1", value: top[0] ? `${top[0].icon ?? ""} ${top[0].label}` : "–", sub: top[0] ? `${num(top[0].total)} คน · ${(top[0].share * 100).toFixed(1)}%` : "", small: true },
          { icon: Users, label: mode === "country" ? "สัดส่วนผู้ติดตามไทย" : "เพิ่มขึ้นมากที่สุด", small: mode !== "country",
            value: mode === "country" ? (th ? `${(th.share * 100).toFixed(1)}%` : "–") : (() => { const m = [...rows].sort((a, b) => b.change - a.change)[0]; return m ? m.label : "–"; })(),
            sub: mode === "country" ? (th ? `${num(th.total)} คน` : "") : (() => { const m = [...rows].sort((a, b) => b.change - a.change)[0]; return m ? `+${num(m.change)} ในช่วงนี้` : ""; })() },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-muted">
              <k.icon size={15} className="text-primary-text" />{k.label}
              {"help" in k && k.help && <span className="ml-auto"><InfoTip text={k.help} side="bottom" /></span>}
            </div>
            <div className={`num mt-3 truncate font-semibold leading-tight tracking-tight ${"small" in k && k.small ? "text-lg" : "text-[26px] leading-none"}`}>{k.value}</div>
            <div className="mt-2 truncate text-xs text-muted">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* trend of selected */}
      <section className="card">
        <div className="card-header">
          <div className="min-w-0">
            <div className="card-title flex items-center gap-2 truncate"><MetaDay />แนวโน้ม · {sel ? `${sel.icon ?? ""} ${sel.label}` : "–"}</div>
            <div className="mt-1"><Legend items={[{ label: "ผู้ติดตามใหม่ต่อวัน", color: "var(--color-c4)" }, { label: "ยอดสะสม", color: "var(--color-c1)" }]} /></div>
          </div>
          <span className="text-xs text-muted">กดแถวในตารางเพื่อดูประเทศ/จังหวัดอื่น</span>
        </div>
        <div className="px-2 pb-3 pt-4 sm:px-4">
          <DailyChart key={`${mode}-${sel?.key}`} data={chart} series={[
            { key: "gain", label: "ผู้ติดตามใหม่", kind: "bar", color: "var(--color-c4)", labels: true },
            { key: "total", label: "ยอดสะสม", kind: "line", color: "var(--color-c1)", axis: "right", format: (n) => compact(n) },
          ]} />
        </div>
      </section>

      {/* table */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="seg" role="tablist" aria-label="แยกตาม">
            <button data-active={mode === "country"} onClick={() => { setMode("country"); setSelected(null); }}>ประเทศ</button>
            <button data-active={mode === "province"} onClick={() => { setMode("province"); setSelected(null); }}>จังหวัด / เมือง</button>
          </div>
          <span className="text-xs text-muted">
            {range.key === "all" ? "ยอดสะสมทั้งหมด" : <>เพิ่มขึ้น = {thDay(baseDay ?? win.from)} → {endDay ? thDay(endDay) : "–"}</>}
          </span>
          {mode === "province" && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted"><Info size={13} />นับจาก 45 เมืองที่มีผู้ติดตามมากที่สุดเท่านั้น</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-xs font-medium text-muted">
              <tr className="border-b border-line">
                <th className="w-12 px-4 py-3 text-left font-medium">#</th>
                <th className="min-w-[200px] px-3 py-3 text-left font-medium">{th_("label", mode === "country" ? "ประเทศ" : "จังหวัด / เมือง", "left")}</th>
                <th className="px-3 py-3 text-right font-medium">{th_("total", "ผู้ติดตาม")}</th>
                <th className="hidden px-3 py-3 text-left font-medium sm:table-cell">{th_("share", "สัดส่วน", "left")}</th>
                <th className="px-3 py-3 text-right font-medium">{th_("change", range.key === "all" ? "ทั้งหมด" : "เพิ่มขึ้นในช่วง")}</th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">30 วันล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((r, i) => {
                const active = sel?.key === r.key;
                return (
                  <tr key={r.key} onClick={() => setSelected(r.key)} aria-selected={active}
                    className={`cursor-pointer transition-colors hover:bg-hover ${active ? "bg-primary-soft hover:bg-primary-soft" : ""}`}>
                    <td className="num whitespace-nowrap px-4 py-2.5 text-xs text-faint">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2.5">
                        {r.icon && <span className="text-lg leading-none" aria-hidden>{r.icon}</span>}
                        <span className={`truncate ${active ? "font-semibold" : "font-medium"}`}>{r.label}</span>
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right font-semibold">{num(r.total)}</td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(1, r.share * 100)}%` }} /></span>
                        <span className="num w-12 text-xs text-muted">{(r.share * 100).toFixed(r.share < 0.1 ? 1 : 0)}%</span>
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                      {r.change > 0 ? <span className="text-up">+{num(r.change)}</span> : r.change < 0 ? <span className="text-down">{num(r.change)}</span> : <Dash />}
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell"><Sparkline values={r.series} width={110} height={22} color="var(--color-c1)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        ข้อมูลจาก Meta เป็นยอดผู้ติดตามสะสม ณ แต่ละวัน · "เพิ่มขึ้น" คำนวณจากผลต่างระหว่างวัน · Meta อัปเดตข้อมูลส่วนนี้ช้ากว่าปกติประมาณ 2 วัน ·
        ข้อมูลอายุ/เพศ Meta ไม่เปิดให้ดึงผ่าน API แล้ว
      </p>
    </div>
  );
}
