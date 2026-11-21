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

export const thDate = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
