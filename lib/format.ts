export const num = (n: number | undefined | null) =>
  n == null ? "–" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export const compact = (n: number | undefined | null) =>
  n == null ? "–" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const usd = (n: number | undefined | null) =>
  n == null ? "–" : "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const pct = (cur: number, prev: number) => {
  if (!prev) return cur ? null : 0; // null = "new" (no baseline)
  return ((cur - prev) / prev) * 100;
};

/** Date + time in Thai time, e.g. "22 พ.ย. 12:15 น." */
export const thDate = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " น.";

export const thDay = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });

/** yyyy-mm-dd arithmetic */
export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

export const TYPE_LABEL: Record<string, string> = {
  reel: "Reels",
  video: "วิดีโอ",
  photo: "โพสต์รูป",
  text: "ข้อความ",
  link: "ลิงก์",
  story: "สตอรี่",
  other: "อื่นๆ",
};

/** The Meta "day" (America/Los_Angeles) an ISO timestamp falls on, as yyyy-mm-dd. */
export const metaDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

/**
 * A Meta "day" (America/Los_Angeles) expressed in Thai time: it starts at PT midnight, i.e. 15:00
 * (or 14:00 during US daylight saving) in Bangkok, and ends 24h later.
 */
export function metaDayInBkk(day: string) {
  let start = new Date(`${day}T08:00:00Z`);
  for (const h of ["07", "08"]) {
    const d = new Date(`${day}T${h}:00:00Z`);
    const hr = Number(d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }));
    if (hr === 0) start = d;
  }
  const fmt = (d: Date) => {
    const b = new Date(d.getTime() + 7 * 3600 * 1000).toISOString();
    return { day: b.slice(0, 10), time: b.slice(11, 16) };
  };
  return { start: fmt(start), end: fmt(new Date(start.getTime() + 86400000)) };
}

/** "5 ชม." / "2 วัน" since an ISO time (real elapsed time, not calendar days). */
export function ageLabel(iso: string, now = Date.now()) {
  const h = Math.max(0, (now - new Date(iso).getTime()) / 3600000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} นาที`;
  if (h < 24) return `${Math.floor(h)} ชม.`;
  return `${Math.floor(h / 24)} วัน`;
}
