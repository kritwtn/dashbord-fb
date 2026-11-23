import { db, safeKey } from "./store";
import { fetchAudience, fetchFollowers, fetchPageDaily, fetchPostDaily, fetchPostMetrics, fetchPosts, fetchStories, pageToken, refreshPages } from "./fb";
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
const YOUNG_DAYS = 14;
const ACTIVE_DAYS = 7;
const ACTIVE_VIEWS = 100;
const bkkDay = (ms: number) => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);

/**
 * Incremental sync. Always refreshed: posts never synced, younger than YOUNG_DAYS, or with ≥ ACTIVE_VIEWS video
 * views in the last ACTIVE_DAYS. Every other post is refreshed by the first sync of each Thai day, so a quiet
 * post that takes off again is picked up. The daily series goes back to the stalest refreshed post (−2 days,
 * Meta finalises late). `full` refetches everything.
 */
export async function syncPage(pageId: string, opts: SyncOptions = {}): Promise<SyncRun> {
  const { source = "api", full = false } = opts;
  const at = Date.now();
  const id = newSyncId(new Date(at));
  const token = await pageToken(pageId);
  const read = (p: string) => db().ref(p).get().then((s) => s.val());

  // none of these need the post list, so they run alongside it
  const storiesP = fetchStories(pageId, token).catch(() => []); // stories only exist for 24h; best effort
  const followersP = fetchFollowers(pageId, token).catch(() => undefined);
  const [page, knownLatest, knownDaily]: any[] = await Promise.all([
    read(`pages/${pageId}`),
    full ? {} : read(`latest/${pageId}`).then((v) => v ?? {}),
    full ? {} : read(`postDaily/${pageId}`).then((v) => v ?? {}),
  ]);
  const lastSyncAt: number | undefined = full ? undefined : page?.lastSyncAt;
  const sinceLast = opts.dailyDays ?? (lastSyncAt ? Math.min(90, Math.max(3, Math.ceil((at - lastSyncAt) / DAY) + 2)) : 30);

  const postDays = full ? 3650 : opts.postDays ?? 90;
  const since = new Date(at - postDays * DAY).toISOString().slice(0, 10);
  const pageSeries = (days: number) =>
    Promise.all([
      fetchPageDaily(pageId, token, days),
      // audience lags ~2 days, so always look back at least a week
      fetchAudience(pageId, token, Math.max(days, 7)).catch(() => ({})),
    ]);
  const early = full ? null : pageSeries(sinceLast);
  early?.catch(() => {}); // awaited below; avoids an unhandled rejection if listing posts fails first
  // the comment-count listing needs pages_read_user_content; remember a refusal instead of retrying every sync
  const { posts, hasCounts } = await fetchPosts(pageId, token, since, full || !page?.noUserContent);

  // ----- which posts to refresh
  const activeSince = new Date(at - ACTIVE_DAYS * DAY).toISOString().slice(0, 10);
  const needsRefresh = (info: PostInfo) => {
    if (full) return true;
    const k = safeKey(info.id);
    const known = knownLatest[k];
    if (!known) return true;
    if (at - new Date(info.createdTime).getTime() < YOUNG_DAYS * DAY) return true;
    let views = 0;
    for (const [d, v] of Object.entries<any>(knownDaily[k] ?? {})) if (d >= activeSince) views += v?.v ?? 0;
    return views >= ACTIVE_VIEWS || bkkDay(known.at ?? 0) < bkkDay(at);
  };
  const refresh = posts.filter((p) => needsRefresh(p.info));

  // ----- daily window: cover the stalest post being refreshed
  const oldest = posts.reduce((t, p) => Math.min(t, new Date(p.info.createdTime).getTime()), at);
  const stalest = refresh.reduce((t, p) => Math.min(t, knownLatest[safeKey(p.info.id)]?.at ?? t), at);
  const dailyDays = full
    ? Math.ceil((at - oldest) / DAY) + 2
    : opts.dailyDays ?? Math.min(90, Math.max(sinceLast, Math.ceil((at - stalest) / DAY) + 2));

  const [metrics, { daily, failed }, [pageDaily, audience], stories, followers] = await Promise.all([
    fetchPostMetrics(refresh, token),
    fetchPostDaily(refresh.map((p) => p.info), token, dailyDays),
    early ?? pageSeries(dailyDays),
    storiesP,
    followersP,
  ]);

  let refreshed = 0;
  const updates: Record<string, unknown> = {};
  for (const { info } of posts) {
    const k = safeKey(info.id);
    // a post counts as refreshed only if both calls worked; otherwise its old numbers stay and the next sync retries
    const m = failed.has(info.id) ? undefined : metrics[info.id];
    if (m) refreshed++;
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
  for (const [day, v] of Object.entries(audience)) updates[`audience/${pageId}/${day}`] = v;
  const run: SyncRun = {
    id, at, source,
    postCount: posts.length + stories.length,
    refreshed: refreshed + stories.length,
    ...(refresh.length > refreshed ? { failed: refresh.length - refreshed } : {}),
    dailyDays,
    ...(full ? { full: true } : {}),
  };
  updates[`syncs/${pageId}/${id}`] = run;
  updates[`pages/${pageId}/lastSyncAt`] = at;
  if (followers != null) updates[`pages/${pageId}/followers`] = followers;
  if (full || !page?.noUserContent) updates[`pages/${pageId}/noUserContent`] = hasCounts ? null : true;
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
