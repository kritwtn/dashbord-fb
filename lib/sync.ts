import { db, safeKey } from "./firebase";
import { fetchPageDaily, fetchPostDaily, fetchPostMetrics, fetchPosts, pageToken, refreshPages } from "./fb";
import type { Metrics, PostInfo, SyncRun } from "./types";

/** Sync id sorts chronologically and is a valid Firebase key, e.g. 20261121-204512 (Asia/Bangkok). */
export function newSyncId(at = new Date()) {
  const bkk = new Date(at.getTime() + 7 * 3600000).toISOString(); // UTC+7
  return `${bkk.slice(0, 10).replace(/-/g, "")}-${bkk.slice(11, 19).replace(/:/g, "")}`;
}

export type SyncOptions = {
  /** How far back to list posts. */
  postDays?: number;
  /** How many days of daily series to (re)fetch. */
  dailyDays?: number;
  source?: SyncRun["source"];
};

export async function syncPage(pageId: string, opts: SyncOptions = {}): Promise<SyncRun> {
  const { postDays = 90, dailyDays = 30, source = "api" } = opts;
  const at = Date.now();
  const id = newSyncId(new Date(at));
  const token = await pageToken(pageId);
  const since = new Date(at - postDays * 86400000).toISOString().slice(0, 10);

  const posts = await fetchPosts(pageId, token, since);
  const metrics = await fetchPostMetrics(posts, token);
  const daily = await fetchPostDaily(
    posts.map((p) => p.info),
    token,
    dailyDays,
  );
  const pageDaily = await fetchPageDaily(pageId, token, dailyDays);

  const updates: Record<string, unknown> = {};
  for (const { info } of posts) {
    const k = safeKey(info.id);
    const m = metrics[info.id];
    const post: PostInfo = { ...info, ...(m?.length != null ? { length: m.length } : {}) };
    updates[`posts/${pageId}/${k}`] = post;
    if (m) {
      updates[`snapshots/${pageId}/${id}/${k}`] = m.metrics;
      updates[`latest/${pageId}/${k}`] = { ...m.metrics, syncId: id, at };
    }
    for (const [day, views] of Object.entries(daily[info.id] ?? {})) {
      updates[`postDaily/${pageId}/${k}/${day}`] = views;
    }
  }
  for (const [day, v] of Object.entries(pageDaily)) updates[`pageDaily/${pageId}/${day}`] = v;
  const run: SyncRun = { id, at, source, postCount: posts.length };
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
