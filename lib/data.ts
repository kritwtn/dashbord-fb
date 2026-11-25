import { metaDayStart } from "./format";
import { db } from "./store";
import type { Metrics, PageDay, PageInfo, PostDay, PostInfo, SyncRun } from "./types";

export async function listPages(): Promise<PageInfo[]> {
  const v = (await db().ref("pages").get()).val() ?? {};
  return Object.values<PageInfo>(v).sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
}

type Latest = Metrics & { syncId: string; at: number };

export type PageBundle = {
  page: PageInfo;
  posts: Record<string, PostInfo>;
  latest: Record<string, Latest>;
  prev: Record<string, Metrics>; // snapshot of the sync before the latest one
  prevSync?: SyncRun;
  lastSync?: SyncRun;
  postDaily: Record<string, Record<string, PostDay>>;
  pageDaily: Record<string, PageDay>;
};

export async function loadPage(pageId: string): Promise<PageBundle | null> {
  const r = (p: string) => db().ref(p);
  const [page, posts, latest, postDaily, pageDaily, syncs] = await Promise.all([
    r(`pages/${pageId}`).get(),
    r(`posts/${pageId}`).get(),
    r(`latest/${pageId}`).get(),
    r(`postDaily/${pageId}`).get(),
    r(`pageDaily/${pageId}`).get(),
    r(`syncs/${pageId}`).orderByKey().limitToLast(2).get(),
  ]);
  if (!page.exists()) return null;
  const runs = Object.values<SyncRun>(syncs.val() ?? {}).sort((a, b) => a.at - b.at);
  const lastSync = runs.at(-1);
  const prevSync = runs.length > 1 ? runs[0] : undefined;
  const prev = prevSync ? ((await r(`snapshots/${pageId}/${prevSync.id}`).get()).val() ?? {}) : {};
  return {
    page: page.val(),
    posts: posts.val() ?? {},
    latest: latest.val() ?? {},
    prev,
    prevSync,
    lastSync,
    postDaily: postDaily.val() ?? {},
    pageDaily: pageDaily.val() ?? {},
  };
}

export async function loadPost(pageId: string, postKey: string) {
  const r = (p: string) => db().ref(p);
  const [page, all, latest, daily, syncs] = await Promise.all([
    r(`pages/${pageId}`).get(),
    r(`posts/${pageId}`).get(),
    r(`latest/${pageId}/${postKey}`).get(),
    r(`postDaily/${pageId}/${postKey}`).get(),
    r(`syncs/${pageId}`).orderByKey().limitToLast(60).get(),
  ]);
  const posts: Record<string, PostInfo> = all.val() ?? {};
  const post = posts[postKey];
  if (!post) throw new Error("ไม่พบโพสต์นี้");
  // masked number for secret mode: #1 = oldest, same as the lists
  const postNo = Object.entries(posts).sort((x, y) => x[1].createdTime.localeCompare(y[1].createdTime)).findIndex(([k]) => k === postKey) + 1;
  const runs = Object.values<SyncRun>(syncs.val() ?? {}).sort((a, b) => a.at - b.at);
  const snaps = await Promise.all(
    runs.map(async (s) => ({ sync: s, m: (await r(`snapshots/${pageId}/${s.id}/${postKey}`).get()).val() as Metrics | null })),
  );
  return {
    page: page.val() as PageInfo,
    post,
    postNo,
    latest: latest.val() as Latest | null,
    daily: (daily.val() ?? {}) as Record<string, PostDay>,
    snapshots: snaps.filter((s) => s.m) as { sync: SyncRun; m: Metrics }[],
  };
}

export async function recentSyncs(pageId: string, n = 8): Promise<SyncRun[]> {
  const v = (await db().ref(`syncs/${pageId}`).orderByKey().limitToLast(n).get()).val() ?? {};
  return Object.values<SyncRun>(v).sort((a, b) => b.at - a.at);
}

export type AudienceDay = { country?: [string, number][]; city?: [string, number][] };
export async function loadAudience(pageId: string): Promise<Record<string, AudienceDay>> {
  return (await db().ref(`audience/${pageId}`).get()).val() ?? {};
}

/**
 * Followers gained per post on a Meta day (or the Meta days `day`..`toDay`) (15:00–15:00 Thai time), from sync snapshots: Meta only exposes a
 * lifetime total per post. Uses the syncs closest to the two day boundaries (at most 6h off), so the result is
 * an approximation over [fromAt, toAt]. `null` when no sync is close enough.
 */
export async function loadFollowGains(pageId: string, day: string, created: Record<string, string>, toDay = day) {
  const HOUR = 3600000;
  const runs = Object.values<SyncRun>((await db().ref(`syncs/${pageId}`).get()).val() ?? {})
    .filter((r) => r.source !== "csv")
    .sort((a, b) => a.at - b.at);
  const start = metaDayStart(day);
  const end = metaDayStart(toDay) + 24 * HOUR;
  const nearest = (t: number) => {
    const r = runs.reduce<SyncRun | undefined>((best, x) => (!best || Math.abs(x.at - t) < Math.abs(best.at - t) ? x : best), undefined);
    return r && Math.abs(r.at - t) <= 6 * HOUR ? r : undefined;
  };
  const from = nearest(start);
  const to = end > Date.now() ? runs.at(-1) : nearest(end);
  if (!from || !to || to.at <= from.at) return null;

  const snap = (r: SyncRun) => db().ref(`snapshots/${pageId}/${r.id}`).get().then((s) => (s.val() ?? {}) as Record<string, Metrics>);
  // latest value per post inside the window (a sync may skip quiet posts)
  const inside = await Promise.all(runs.filter((r) => r.at > from.at && r.at <= to.at).map(snap));
  const last: Record<string, number> = {};
  const lastV: Record<string, number> = {};
  for (const s of inside) for (const [k, m] of Object.entries(s)) {
    last[k] = Number(m?.followersGained) || 0;
    lastV[k] = Number(m?.views) || 0;
  }
  // baseline per post: newest snapshot at or before `from`; posts published after `from` start at 0
  const base: Record<string, number> = {};
  const baseV: Record<string, number> = {};
  let missing = Object.keys(last).filter((k) => {
    const t = created[k] ? new Date(created[k]).getTime() : 0;
    if (t >= from.at) base[k] = baseV[k] = 0;
    return t < from.at;
  });
  for (const r of runs.filter((x) => x.at <= from.at).reverse().slice(0, 12)) {
    if (!missing.length) break;
    const s = await snap(r);
    for (const k of missing) if (s[k]) {
      base[k] = Number(s[k].followersGained) || 0;
      baseV[k] = Number(s[k].views) || 0;
    }
    missing = missing.filter((k) => !(k in base));
  }
  const gain: Record<string, number> = {};
  const views: Record<string, number> = {}; // total views (post_media_view) gained in the window, same method
  for (const k of Object.keys(last)) if (k in base) { // no baseline → unknown, not counted
    gain[k] = Math.max(0, last[k] - base[k]);
    views[k] = Math.max(0, lastV[k] - baseV[k]);
  }
  return { gain, views, fromAt: from.at, toAt: to.at };
}
