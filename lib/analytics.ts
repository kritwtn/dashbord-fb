import type { PageBundle } from "./data";
import { addDays, daysBetween, pct } from "./format";
import type { Window } from "./range";
import type { PageDay, PostInfo } from "./types";

type DailyMap = Record<string, { v: number; r: number }> | undefined;

export function sumDaily(m: DailyMap, from: string, to: string) {
  let v = 0, r = 0;
  if (!m || !from) return { v, r };
  for (const [d, x] of Object.entries(m)) if (d >= from && d <= to) { v += x?.v ?? 0; r += x?.r ?? 0; }
  return { v, r };
}

export function dayBounds(b: PageBundle): [string, string] {
  let min = "9999", max = "";
  const see = (d: string) => { if (d < min) min = d; if (d > max) max = d; };
  Object.keys(b.pageDaily).forEach(see);
  Object.values(b.postDaily).forEach((m) => Object.keys(m).forEach(see));
  const today = new Date().toISOString().slice(0, 10);
  return [max ? min : today, max || today];
}

export function pageSum(b: PageBundle, key: keyof PageDay, from: string, to: string) {
  if (!from) return 0;
  let s = 0;
  for (const [d, v] of Object.entries(b.pageDaily)) if (d >= from && d <= to) s += v[key] ?? 0;
  return s;
}

/** #1 = oldest post; used for masked titles in secret mode. */
export function postNumbers(b: PageBundle) {
  const order = Object.entries(b.posts).sort((x, y) => x[1].createdTime.localeCompare(y[1].createdTime));
  return Object.fromEntries(order.map(([k], i) => [k, i + 1])) as Record<string, number>;
}

export type PostRow = {
  key: string;
  p: PostInfo;
  views: number;
  revenue: number;
  growth: number | null | undefined;
  totalViews: number;
  delta: number | undefined;
  reactions: number;
  comments: number;
  shares: number;
  followers: number;
  totalRevenue: number;
  spark: number[];
};

export function buildRows(b: PageBundle, win: Window, lastDay: string): PostRow[] {
  const sparkDays = daysBetween(addDays(lastDay, -13), lastDay);
  return Object.entries(b.posts).map(([key, p]) => {
    const L = b.latest[key];
    const P = b.prev[key];
    const cur = sumDaily(b.postDaily[key], win.from, win.to);
    const prev = sumDaily(b.postDaily[key], win.prevFrom, win.prevTo);
    // stories have no daily series: use their lifetime views as "in range" when created inside the window
    const story = p.type === "story";
    const inWin = p.createdTime.slice(0, 10) >= win.from && p.createdTime.slice(0, 10) <= addDays(win.to, 1);
    return {
      key, p,
      views: story ? (inWin ? L?.views ?? 0 : 0) : cur.v,
      revenue: cur.r,
      growth: story ? undefined : win.prevFrom ? pct(cur.v, prev.v) : undefined,
      totalViews: L?.views ?? 0,
      delta: L && P ? L.views - P.views : undefined,
      reactions: L?.reactions ?? 0,
      comments: L?.comments ?? 0,
      shares: L?.shares ?? 0,
      followers: L?.followersGained ?? 0,
      totalRevenue: L?.revenue ?? 0,
      spark: sparkDays.map((d) => b.postDaily[key]?.[d]?.v ?? 0),
    };
  });
}
