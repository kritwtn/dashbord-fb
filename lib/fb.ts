import { db } from "./store";

// process.env exists only in the CLI; the browser reads tokens from the database.
const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
import { emptyMetrics, type Metrics, type PageDay, type PostDay, type PostInfo } from "./types";

const V = env.FB_GRAPH_VERSION ?? "v23.0";
const BASE = `https://graph.facebook.com/${V}`;

type GraphError = { message: string; code: number; type?: string };
export class FbError extends Error {
  constructor(public err: GraphError) {
    super(`FB ${err.code}: ${err.message}`);
  }
}

async function graph<T = any>(pathAndQuery: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(pathAndQuery.startsWith("http") ? pathAndQuery : `${BASE}/${pathAndQuery}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw new FbError(json.error);
  return json as T;
}

/** Rate limits, timeouts and Meta-side hiccups: worth retrying, and never to be stored as "0". */
const TRANSIENT = new Set([-2, -1, 1, 2, 4, 17, 32, 341, 368, 613, 80001, 80002, 80006]);
const isTransient = (r: any): r is FbError => r instanceof FbError && TRANSIENT.has(r.err.code);

const CHUNK = 40; // items per batch call (Graph allows 50; it runs them one after another, so smaller is faster)
const PARALLEL = 6; // batch calls in flight

async function batchCall(urls: string[], token: string): Promise<(any | FbError)[]> {
  try {
    const body = new URLSearchParams({
      access_token: token,
      include_headers: "false",
      batch: JSON.stringify(urls.map((relative_url) => ({ method: "GET", relative_url }))),
    });
    const res = await fetch(`https://graph.facebook.com/${V}`, { method: "POST", body, cache: "no-store" });
    const json = await res.json();
    if (!Array.isArray(json)) throw new FbError(json.error ?? { message: "batch failed", code: -1 });
    return urls.map((_, i) => {
      const item = json[i];
      if (!item) return new FbError({ message: "timeout", code: -2 });
      const parsed = JSON.parse(item.body);
      return parsed.error ? new FbError(parsed.error) : parsed;
    });
  } catch (err) {
    if (err instanceof FbError && !TRANSIENT.has(err.err.code)) throw err; // e.g. expired token: stop the sync
    const fail = err instanceof FbError ? err : new FbError({ message: String(err), code: -2 });
    return urls.map(() => fail);
  }
}

/** Run many relative GETs via the Graph batch API: chunks go out in parallel, transient failures are retried once. */
async function batch(relativeUrls: string[], token: string): Promise<(any | FbError)[]> {
  const out: (any | FbError)[] = new Array(relativeUrls.length);
  const run = async (idx: number[]) => {
    const chunks: number[][] = [];
    for (let i = 0; i < idx.length; i += CHUNK) chunks.push(idx.slice(i, i + CHUNK));
    const worker = async () => {
      for (let c = chunks.shift(); c; c = chunks.shift()) {
        const chunk = c;
        const res = await batchCall(chunk.map((i) => relativeUrls[i]), token);
        chunk.forEach((i, j) => (out[i] = res[j]));
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker));
  };
  await run(relativeUrls.map((_, i) => i));
  const retry = out.flatMap((r, i) => (isTransient(r) ? [i] : []));
  if (retry.length) {
    await new Promise((r) => setTimeout(r, 1500));
    await run(retry);
  }
  return out;
}

// ---------- Pages & tokens ----------

/** Fetch all pages the user token administers; persist page tokens server-side (never-expiring). */
export async function refreshPages(): Promise<{ id: string; name: string; followers?: number }[]> {
  const userToken = env.FB_USER_TOKEN;
  if (!userToken) throw new Error("FB_USER_TOKEN is not set in .env");
  const pages: { id: string; name: string; access_token: string; followers_count?: number }[] = [];
  let next: string | undefined = `me/accounts?fields=id,name,access_token,followers_count&limit=100`;
  while (next) {
    const r: any = await graph(next, userToken);
    pages.push(...r.data);
    next = r.paging?.next;
  }
  const updates: Record<string, unknown> = {};
  for (const p of pages) {
    updates[`_secrets/pageTokens/${p.id}`] = p.access_token;
    updates[`pages/${p.id}/id`] = p.id;
    updates[`pages/${p.id}/name`] = p.name;
    updates[`pages/${p.id}/noUserContent`] = null; // new token: permissions may have changed
    if (p.followers_count != null) updates[`pages/${p.id}/followers`] = p.followers_count;
  }
  await db().ref().update(updates);
  return pages.map((p) => ({ id: p.id, name: p.name, followers: p.followers_count }));
}

/** Current follower count of a page. */
export async function fetchFollowers(pageId: string, token: string): Promise<number | undefined> {
  const r: any = await graph(pageId, token, { fields: "followers_count" });
  return r.followers_count;
}

export async function pageToken(pageId: string): Promise<string> {
  const snap = await db().ref(`_secrets/pageTokens/${pageId}`).get();
  if (snap.exists()) return snap.val();
  if (pageId === env.FB_PAGE_ID && env.FB_PAGE_TOKEN) return env.FB_PAGE_TOKEN;
  if (!env.FB_USER_TOKEN) throw new Error(`ไม่พบ token ของเพจ ${pageId}`);
  await refreshPages();
  const again = await db().ref(`_secrets/pageTokens/${pageId}`).get();
  if (!again.exists()) throw new Error(`No token for page ${pageId}`);
  return again.val();
}

// ---------- Posts ----------

function classify(p: any): { type: PostInfo["type"]; videoId?: string } {
  const link: string = p.permalink_url ?? "";
  const reel = link.match(/\/reel\/(\d+)/);
  if (reel) return { type: "reel", videoId: reel[1] };
  const vid = link.match(/\/videos\/(?:[^/]+\/)?(\d+)/);
  if (vid || p.status_type === "added_video") return { type: "video", videoId: vid?.[1] };
  if (p.status_type === "added_photos") return { type: "photo" };
  if (p.status_type === "shared_story" || /^https?:\/\//.test((p.message ?? "").trim().split(/\s/).pop() ?? "") && p.full_picture)
    return { type: "link" };
  if (p.full_picture) return { type: "photo" };
  if (p.status_type === "mobile_status_update" || p.status_type === "published_story") return { type: "text" };
  return { type: "other" };
}

/**
 * Page stories currently live (Graph only returns stories from the last ~24h, so they are captured
 * at sync time). Metrics: story_media_view (views), replies, shares.
 */
export async function fetchStories(pageId: string, token: string) {
  const r: any = await graph(`${pageId}/stories`, token, { limit: "100" });
  const list: any[] = (r.data ?? []).filter((s: any) => s.status === "published");
  if (!list.length) return [];
  const urls: string[] = [];
  for (const s of list) {
    urls.push(`${s.post_id}/insights?metric=story_media_view,pages_fb_story_replies,pages_fb_story_shares`);
    urls.push(`${s.media_id}?fields=picture,full_picture`);
  }
  const res = await batch(urls, token);
  return list.map((s, i) => {
    const ins = res[i * 2];
    const pic = res[i * 2 + 1];
    const m = emptyMetrics();
    if (!(ins instanceof FbError)) {
      m.views = val(ins.data, "story_media_view") ?? 0;
      m.comments = val(ins.data, "pages_fb_story_replies") ?? 0;
      m.shares = val(ins.data, "pages_fb_story_shares") ?? 0;
    }
    const picture = !(pic instanceof FbError) ? pic.full_picture ?? pic.picture : undefined;
    const info: PostInfo = {
      id: `story_${s.post_id}`,
      createdTime: new Date(Number(s.creation_time) * 1000).toISOString(),
      message: "",
      permalink: s.url ?? "",
      statusType: `story_${s.media_type ?? ""}`,
      type: "story",
      ...(picture ? { picture } : {}),
    };
    return { info, metrics: m };
  });
}

export type RawCounts = { comments?: number; reactions?: number; shares?: number };

/** Lists posts published since `sinceIso`. Comment/reaction counts need pages_read_user_content; falls back without. */
export async function fetchPosts(pageId: string, token: string, sinceIso: string, tryCounts = true) {
  const base = "id,created_time,message,permalink_url,status_type,full_picture,shares";
  const rich = `${base},comments.summary(true).limit(0),reactions.summary(true).limit(0)`;
  const list = async (fields: string) => {
    const rows: any[] = [];
    let next: string | undefined = `${pageId}/posts?fields=${encodeURIComponent(fields)}&limit=100&since=${encodeURIComponent(sinceIso)}`;
    while (next) {
      const r: any = await graph(next, token);
      rows.push(...r.data);
      next = r.paging?.next;
    }
    return rows;
  };
  let rows: any[];
  let hasCounts = tryCounts;
  try {
    rows = await list(tryCounts ? rich : base);
  } catch (e) {
    if (tryCounts && e instanceof FbError && e.err.code === 10) {
      hasCounts = false;
      rows = await list(base);
    } else throw e;
  }
  const posts = rows.map((p) => {
    const c = classify(p);
    const info: PostInfo = {
      id: p.id,
      createdTime: p.created_time,
      message: p.message ?? "",
      permalink: p.permalink_url ?? "",
      statusType: p.status_type ?? "",
      type: c.type,
      ...(c.videoId ? { videoId: c.videoId } : {}),
      ...(p.full_picture ? { picture: p.full_picture } : {}),
    };
    const counts: RawCounts = {
      shares: p.shares?.count ?? 0,
      ...(hasCounts
        ? { comments: p.comments?.summary?.total_count ?? 0, reactions: p.reactions?.summary?.total_count ?? 0 }
        : {}),
    };
    return { info, counts };
  });
  return { posts, hasCounts };
}

const POST_LIFETIME = "post_media_view,post_total_media_view_unique,post_video_views,post_clicks,post_reactions_by_type_total";

const val = (data: any[] | undefined, name: string, period = "lifetime") =>
  data?.find((m) => m.name === name && m.period === period)?.values?.[0]?.value;
/**
 * Money values come as {currency, microAmount}; older metrics as a plain number.
 * Despite the name, microAmount is in 1e-8 units: page content_monetization_earnings 1081015299
 * equals monetization_approximate_earnings 10.81015299 for the same day.
 */
const usd = (v: any): number =>
  v == null ? 0 : typeof v === "number" ? v : v.microAmount != null ? Number(v.microAmount) / 1e8 : 0;
const sumObj = (o: any) => (o && typeof o === "object" ? Object.values(o).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0);

/** Lifetime metrics for many posts (batched). Posts whose calls kept failing are left out, so old values survive. */
export async function fetchPostMetrics(
  posts: { info: PostInfo; counts: RawCounts }[],
  token: string,
): Promise<Record<string, { metrics: Metrics; length?: number }>> {
  const urls: string[] = [];
  for (const { info } of posts) {
    urls.push(`${info.id}/insights?metric=${POST_LIFETIME}&period=lifetime`);
    urls.push(`${info.id}/insights?metric=content_monetization_earnings&period=lifetime`);
    if (info.videoId) {
      urls.push(`${info.videoId}/video_insights`);
      urls.push(`${info.videoId}?fields=length`);
    }
  }
  const res = await batch(urls, token);
  const out: Record<string, { metrics: Metrics; length?: number }> = {};
  let i = 0;
  for (const { info, counts } of posts) {
    const n = info.videoId ? 4 : 2;
    if (res.slice(i, i + n).some(isTransient)) {
      i += n;
      continue;
    }
    const m = emptyMetrics();
    const ins = res[i++];
    if (!(ins instanceof FbError)) {
      m.views = val(ins.data, "post_media_view") ?? 0;
      m.reach = val(ins.data, "post_total_media_view_unique") ?? 0;
      m.videoViews = val(ins.data, "post_video_views") ?? 0;
      m.clicks = val(ins.data, "post_clicks") ?? 0;
      m.reactions = sumObj(val(ins.data, "post_reactions_by_type_total"));
    }
    const earn = res[i++];
    if (!(earn instanceof FbError)) m.revenue = usd(val(earn.data, "content_monetization_earnings"));
    if (counts.reactions != null) m.reactions = counts.reactions;
    m.shares = counts.shares ?? 0;
    m.comments = counts.comments ?? 0;
    let length: number | undefined;
    if (info.videoId) {
      const vi = res[i++];
      const vl = res[i++];
      if (!(vi instanceof FbError)) {
        const social = val(vi.data, "post_video_social_actions") ?? {};
        if (counts.comments == null) m.comments = social.COMMENT ?? 0;
        m.shares = Math.max(m.shares, social.SHARE ?? 0);
        m.plays = val(vi.data, "fb_reels_total_plays") ?? 0;
        m.followersGained = val(vi.data, "post_video_followers") ?? 0;
        m.avgWatchMs = val(vi.data, "post_video_avg_time_watched") ?? 0;
        m.viewTimeMs = val(vi.data, "post_video_view_time") ?? 0;
        if (!m.reactions) m.reactions = sumObj(val(vi.data, "post_video_likes_by_reaction_type"));
      }
      if (!(vl instanceof FbError) && vl.length != null) length = Math.round(vl.length);
    }
    out[info.id] = { metrics: m, ...(length != null ? { length } : {}) };
  }
  return out;
}

// ---------- Daily series ----------

/** Graph "day" values end at midnight Pacific; the value belongs to the day before end_time. */
const dayOf = (endTime: string) => {
  const d = new Date(endTime);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const unix = (d: Date) => Math.floor(d.getTime() / 1000).toString();

/**
 * Daily video views + revenue for each post, from `days` ago (or the post's creation, whichever is later)
 * until today. Graph caps a range at ~90 days, so long histories are fetched in 90-day windows.
 */
export async function fetchPostDaily(posts: PostInfo[], token: string, days = 30) {
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + 1);
  const floor = until.getTime() - days * 86400000;
  const jobs: { post: PostInfo; url: string }[] = [];
  for (const p of posts) {
    let start = Math.max(new Date(p.createdTime).getTime() - 86400000, floor);
    while (start < until.getTime()) {
      const stop = Math.min(start + 90 * 86400000, until.getTime());
      jobs.push({
        post: p,
        url: `${p.id}/insights?metric=post_video_views,content_monetization_earnings&period=day&since=${unix(new Date(start))}&until=${unix(new Date(stop))}`,
      });
      start = stop;
    }
  }
  const res = await batch(
    jobs.map((j) => j.url),
    token,
  );
  const out: Record<string, Record<string, PostDay>> = {};
  const failed = new Set<string>();
  jobs.forEach(({ post }, i) => {
    const r = res[i];
    if (isTransient(r)) failed.add(post.id);
    if (r instanceof FbError) return;
    const byDay = (out[post.id] ??= {});
    for (const m of r.data ?? []) {
      if (m.period !== "day") continue;
      for (const v of m.values) {
        if (!v.end_time) continue;
        const day = dayOf(v.end_time);
        const d = (byDay[day] ??= { v: 0, r: 0 });
        if (m.name === "post_video_views") d.v = Number(v.value) || 0;
        if (m.name === "content_monetization_earnings") d.r = usd(v.value);
      }
    }
  });
  return { daily: out, failed };
}

const PAGE_DAILY: Record<string, keyof PageDay> = {
  page_follows: "follows",
  page_daily_follows_unique: "newFollows",
  page_media_view: "mediaViews",
  page_total_media_view_unique: "reach",
  page_post_engagements: "engagements",
  page_video_views: "videoViews",
};

export async function fetchPageDaily(pageId: string, token: string, days = 30) {
  const out: Record<string, PageDay> = {};
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  // Graph allows ~90 days per request; walk backwards in 90-day windows.
  for (let left = days; left > 0; left -= 90) {
    const span = Math.min(90, left);
    const since = new Date(end.getTime() - span * 86400000);
    const r: any = await graph(`${pageId}/insights`, token, {
      metric: Object.keys(PAGE_DAILY).join(","),
      period: "day",
      since: unix(since),
      until: unix(end),
    });
    for (const m of r.data ?? []) {
      const key = PAGE_DAILY[m.name];
      if (!key) continue;
      for (const v of m.values) {
        if (!v.end_time) continue;
        const day = dayOf(v.end_time);
        // Skip buckets whose day hasn't started yet (Graph returns junk there); today's partial bucket is kept
        // and simply overwritten by the next sync.
        if (new Date(v.end_time).getTime() - 86400000 > Date.now()) continue;
        (out[day] ??= {})[key] = Number(v.value) || 0;
      }
    }
    try {
      const e: any = await graph(`${pageId}/insights`, token, {
        metric: "monetization_approximate_earnings",
        period: "day",
        since: unix(since),
        until: unix(end),
      });
      for (const m of e.data ?? [])
        for (const v of m.values) {
          if (!v.end_time || new Date(v.end_time).getTime() - 86400000 > Date.now()) continue;
          (out[dayOf(v.end_time)] ??= {}).revenue = usd(v.value);
        }
    } catch {
      // page not monetized / no monetization access — leave revenue empty
    }
    end.setTime(since.getTime());
  }
  return out;
}

/** [name, followers] pairs, largest first. Stored as arrays because city names may contain "." etc. */
export type Pairs = [string, number][];
export type AudienceDay = { country?: Pairs; city?: Pairs };

const toPairs = (o: Record<string, number> | null | undefined): Pairs =>
  Object.entries(o ?? {})
    .map(([k, v]) => [k, Number(v) || 0] as [string, number])
    .sort((a, b) => b[1] - a[1]);

/**
 * Follower totals by country and by city (Meta returns the top 45 cities only), one snapshot per day.
 * Values are cumulative; the per-day gain is the difference between consecutive days.
 * Meta lags ~2 days here and repeats the last value for the newest days.
 */
export async function fetchAudience(pageId: string, token: string, days = 30) {
  const out: Record<string, AudienceDay> = {};
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  for (let left = days; left > 0; left -= 90) {
    const span = Math.min(90, left);
    const since = new Date(end.getTime() - span * 86400000);
    const r: any = await graph(`${pageId}/insights`, token, {
      metric: "page_follows_country,page_follows_city",
      period: "day",
      since: unix(since),
      until: unix(end),
    });
    for (const m of r.data ?? []) {
      const key = m.name === "page_follows_country" ? "country" : m.name === "page_follows_city" ? "city" : null;
      if (!key) continue;
      for (const v of m.values) {
        if (!v.end_time || new Date(v.end_time).getTime() - 86400000 > Date.now()) continue;
        const pairs = toPairs(v.value);
        if (pairs.length) (out[dayOf(v.end_time)] ??= {})[key] = pairs;
      }
    }
    end.setTime(since.getTime());
  }
  return out;
}
