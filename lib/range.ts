import { usePathname, useRouter, useSearchParams } from "./nav";
import { progress } from "@/components/TopProgress";
import { useCallback, useMemo } from "react";
import { addDays } from "./format";

export type RangeKey = "month" | "1" | "7" | "28" | "90" | "all" | "day";

export const RANGES: { key: RangeKey; label: string; short: string }[] = [
  { key: "month", label: "เดือนนี้", short: "เดือนนี้" },
  { key: "1", label: "วันล่าสุด", short: "1 วัน" },
  { key: "7", label: "7 วัน", short: "7 ว." },
  { key: "28", label: "28 วัน", short: "28 ว." },
  { key: "90", label: "90 วัน", short: "90 ว." },
  { key: "all", label: "ทั้งหมด", short: "ทั้งหมด" },
  { key: "day", label: "เลือกวัน", short: "เลือกวัน" },
];

export type Window = { from: string; to: string; prevFrom: string; prevTo: string; len: number };

export function computeWindow(key: RangeKey, firstDay: string, lastDay: string, pickDay: string): Window {
  if (key === "day") return { from: pickDay, to: pickDay, prevFrom: addDays(pickDay, -1), prevTo: addDays(pickDay, -1), len: 1 };
  if (key === "all") return { from: firstDay, to: lastDay, prevFrom: "", prevTo: "", len: 0 };
  if (key === "month") {
    // month-to-date vs the same days of the previous month (clamped to that month's length)
    const [y, m, d] = lastDay.split("-").map(Number);
    const pm = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
    const pmLast = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay, prevFrom: `${pm}-01`, prevTo: `${pm}-${String(Math.min(d, pmLast)).padStart(2, "0")}`, len: d };
  }
  const n = Number(key);
  const from = addDays(lastDay, -(n - 1));
  return { from, to: lastDay, prevFrom: addDays(from, -n), prevTo: addDays(from, -1), len: n };
}

/** Weekday filter: 7 chars Mon..Sun, "1" = included. */
export const ALL_DAYS = "1111111";
export const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
export const weekdayIndex = (day: string) => (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7; // Mon=0
export const makeAllow = (mask: string) => (mask === ALL_DAYS ? undefined : (day: string) => mask[weekdayIndex(day)] === "1");
export function maskLabel(mask: string) {
  if (mask === ALL_DAYS) return "ทุกวัน";
  if (mask === "1111100") return "จันทร์–ศุกร์";
  if (mask === "0000011") return "เสาร์–อาทิตย์";
  return WEEKDAY_LABELS.filter((_, i) => mask[i] === "1").join(" ") || "ไม่ได้เลือก";
}

/** Range lives in the URL (?r=…&d=…) so Overview and Posts share it and links are shareable. */
export function useRangeParam(lastDay: string) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const key = (RANGES.find((r) => r.key === sp.get("r"))?.key ?? "month") as RangeKey;
  const pickDay = sp.get("d") ?? addDays(lastDay, -1);
  const rawMask = sp.get("w");
  const mask = rawMask && /^[01]{7}$/.test(rawMask) && rawMask !== "0000000" ? rawMask : ALL_DAYS;
  const set = useCallback(
    (patch: { r?: RangeKey; d?: string; w?: string }) => {
      const next = new URLSearchParams(sp.toString());
      if (patch.r) patch.r === "month" ? next.delete("r") : next.set("r", patch.r);
      if (patch.d) next.set("d", patch.d);
      if (patch.r && patch.r !== "day") next.delete("d");
      if (patch.w) patch.w === ALL_DAYS ? next.delete("w") : next.set("w", patch.w);
      const qs = next.toString();
      // client-side only: everything is computed from data already loaded
      router.replace(qs ? `${pathname}?${qs}` : pathname);
      progress.pulse();
    },
    [sp, pathname, router],
  );
  const allow = useMemo(() => makeAllow(mask), [mask]);
  return { key, pickDay, mask, allow, set, query: sp.toString() };
}
