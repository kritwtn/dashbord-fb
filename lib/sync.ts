import { db, safeKey } from "./firebase";
import { fetchPageDaily, fetchPostDaily, fetchPostMetrics, fetchPosts, fetchStories, pageToken, refreshPages } from "./fb";
import type { Metrics, PostInfo, SyncRun } from "./types";

/** Sync id sorts chronologically and is a valid Firebase key, e.g. 20261121-204512 (Asia/Bangkok). */
export function newSyncId(at = new Date()) {
  const bkk = new Date(at.getTime() + 7 * 3600000).toISOString(); // UTC+7
  return `${bkk.slice(0, 10).replace(/-/g, "")}-${bkk.slice(11, 19).replace(/:/g, "")}`;
}

export type SyncOptions = {
  /** How far back to list posts (normal sync). */
  postDays?: number;
  /** Force this many days of daily series instead of "since last sync". */
  dailyDays?: number;
  source?: SyncRun["source"];
  /** Backfill everything since the first post, refreshing every post. */
  full?: boolean;
};

const DAY = 86400000;
/** A post counts as "active" (worth re-fetching) if it is this young or got views in the last ACTIVE_DAYS. */
const YOUNG_DAYS = 14;
const ACTIVE_DAYS = 7;

/**
 * Normal sync is incremental: daily series only from the last sync (−2 days overlap, Meta finalises
 * late) to today, and lifetime metrics only for new/young/active posts. `full` refetches everything.
 */
export async function syncPage(pageId: string, opts: SyncOptions = {}): Promise<SyncRun> {
  const { source = "api", full = false } = opts;
  const at = Date.now();
  const id = newSyncId(new Date(at));
  const token = await pageToken(pageId);

  const postDays = full ? 3650 : opts.postDays ?? 90;
  const since = new Date(at - postDays * DAY).toISOString().slice(0, 10);
  const posts = await fetchPosts(pageId, token, since);

  const [lastSyncAt, knownLatest, knownDaily] = full
    ? [undefined, {}, {}]
    : await Promise.all([
        db().ref(`pages/${pageId}/lastSyncAt`).get().then((s) => s.val() as number | null),
        db().ref(`latest/${pageId}`).get().then((s) => s.val() ?? {}),
        db().ref(`postDaily/${pageId}`).get().then((s) => s.val() ?? {}),
      ]);

  // ----- which posts to refresh
  const activeSince = new Date(at - ACTIVE_DAYS * DAY).toISOString().slice(0, 10);
  const isActive = (info: PostInfo) => {
    if (full) return true;
    const k = safeKey(info.id);
    if (!(knownLatest as any)[k]) return true; // never synced
    if (at - new Date(info.createdTime).getTime() < YOUNG_DAYS * DAY) return true;
    const days = (knownDaily as any)[k] ?? {};
    return Object.entries<any>(days).some(([d, v]) => d >= activeSince && (v?.v ?? 0) > 0);
  };
  const refresh = posts.filter((p) => isActive(p.info));

  // ----- daily window
  const oldest = posts.reduce((t, p) => Math.min(t, new Date(p.info.createdTime).getTime()), at);
  const dailyDays = full
    ? Math.ceil((at - oldest) / DAY) + 2
    : opts.dailyDays ?? (lastSyncAt ? Math.min(90, Math.max(3, Math.ceil((at - lastSyncAt) / DAY) + 2)) : 30);

  const [metrics, daily, pageDaily, stories] = await Promise.all([
    fetchPostMetrics(refresh, token),
    fetchPostDaily(refresh.map((p) => p.info), token, dailyDays),
    fetchPageDaily(pageId, token, dailyDays),
    fetchStories(pageId, token).catch(() => []), // stories only exist for 24h; best effort
  ]);

  const updates: Record<string, unknown> = {};
  for (const { info } of posts) {
    const k = safeKey(info.id);
    const m = metrics[info.id];
    // keep previously-known length when we didn't refetch this post
    if (m) updates[`posts/${pageId}/${k}`] = { ...info, ...(m.length != null ? { length: m.length } : {}) };
    else for (const [f, v] of Object.entries(info)) updates[`posts/${pageId}/${k}/${f}`] = v;
    if (m) {
      updates[`snapshots/${pageId}/${id}/${k}`] = m.metrics;
      updates[`latest/${pageId}/${k}`] = { ...m.metrics, syncId: id, at };
    }
    for (const [day, d] of Object.entries(daily[info.id] ?? {})) updates[`postDaily/${pageId}/${k}/${day}`] = d;
  }
  for (const s of stories) {
    const k = safeKey(s.info.id);
    updates[`posts/${pageId}/${k}`] = s.info;
    updates[`snapshots/${pageId}/${id}/${k}`] = s.metrics;
    updates[`latest/${pageId}/${k}`] = { ...s.metrics, syncId: id, at };
  }
  for (const [day, v] of Object.entries(pageDaily)) updates[`pageDaily/${pageId}/${day}`] = v;
  const run: SyncRun = {
    id, at, source,
    postCount: posts.length + stories.length,
    refreshed: refresh.length + stories.length,
    dailyDays,
    ...(full ? { full: true } : {}),
  };
  updates[`syncs/${pageId}/${id}`] = run;
  updates[`pages/${pageId}/lastSyncAt`] = at;
  await db().ref().update(updates);
  return run;
}

export async function syncPages(pageIds: string[] | "enabled", opts: SyncOptions = {}) {
  let ids: string[];
  if (pageIds === "enabled") {
    await refreshPages();
    const snap = await db().ref("pages").get();
    ids = Object.values<any>(snap.val() ?? {})
      .filter((p) => p.enabled)
      .map((p) => p.id);
  } else ids = pageIds;
  const results: { pageId: string; run?: SyncRun; error?: string }[] = [];
  for (const pageId of ids) {
    try {
      results.push({ pageId, run: await syncPage(pageId, opts) });
    } catch (e: any) {
      results.push({ pageId, error: e?.message ?? String(e) });
    }
  }
  return results;
}

/** Store an imported CSV (Meta Business Suite "เนื้อหา" export) as a snapshot. */
export async function importSnapshot(
  pageId: string,
  rows: { info: PostInfo; metrics: Metrics }[],
  at = Date.now(),
): Promise<SyncRun> {
  const id = newSyncId(new Date(at)) + "-csv";
  const updates: Record<string, unknown> = {};
  const latestSnap = await db().ref(`latest/${pageId}`).get();
  const latest = latestSnap.val() ?? {};
  const known = (await db().ref(`posts/${pageId}`).get()).val() ?? {};
  for (const { info, metrics } of rows) {
    const k = safeKey(info.id);
    if (!known[k]) updates[`posts/${pageId}/${k}`] = info; // don't clobber richer API data
    updates[`snapshots/${pageId}/${id}/${k}`] = metrics;
    if (!latest[k] || latest[k].at <= at) updates[`latest/${pageId}/${k}`] = { ...metrics, syncId: id, at };
  }
  const run: SyncRun = { id, at, source: "csv", postCount: rows.length };
  updates[`syncs/${pageId}/${id}`] = run;
  await db().ref().update(updates);
  return run;
}
