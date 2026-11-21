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
 * Followers gained per post on a given day, derived from sync snapshots (Meta only exposes a lifetime
 * total per post): last snapshot of `day` minus last snapshot before `day`. Sync ids are
 * yyyymmdd-hhmmss in Bangkok time, so "day" here is approximate vs Meta's Pacific days.
 *   gain[post]  = followers gained that day (only when both snapshots exist, or the post is new that day)
 *   total[post] = lifetime followers from the latest snapshot up to that day
 */
export async function loadFollowGains(pageId: string, day: string) {
  const ids = Object.keys((await db().ref(`syncs/${pageId}`).get()).val() ?? {}).sort();
  const d = day.replace(/-/g, "");
  const onDay = ids.filter((k) => k.slice(0, 8) === d).at(-1);
  const before = ids.filter((k) => k.slice(0, 8) < d).at(-1);
  // nothing synced up to that day yet → fall back to the latest lifetime totals (flagged)
  const upTo = onDay ?? before ?? ids.at(-1);
  const fromLater = !onDay && !before && !!upTo;
  const [cur, prev] = await Promise.all([
    upTo ? db().ref(`snapshots/${pageId}/${upTo}`).get().then((s) => s.val() ?? {}) : {},
    onDay && before ? db().ref(`snapshots/${pageId}/${before}`).get().then((s) => s.val() ?? {}) : null,
  ]);
  const total: Record<string, number> = {};
  const gain: Record<string, number> = {};
  for (const [k, m] of Object.entries<any>(cur)) {
    const t = Number(m?.followersGained) || 0;
    total[k] = t;
    if (!onDay) continue;
    if (prev && prev[k]) gain[k] = Math.max(0, t - (Number(prev[k].followersGained) || 0));
    else if (prev) gain[k] = t; // first seen after the previous snapshot → new post
  }
  return { gain, total, hasDaily: !!(onDay && before), fromLater };
}
