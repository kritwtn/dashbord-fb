import { db } from "./firebase";
import { emptyMetrics, type Metrics, type PageDay, type PostInfo } from "./types";

const V = process.env.FB_GRAPH_VERSION ?? "v23.0";
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

/** Graph batch API: up to 50 relative GETs per call. Returns parsed body or FbError per item. */
async function batch(relativeUrls: string[], token: string): Promise<(any | FbError)[]> {
  const out: (any | FbError)[] = [];
  for (let i = 0; i < relativeUrls.length; i += 50) {
    const chunk = relativeUrls.slice(i, i + 50);
    const body = new URLSearchParams({
      access_token: token,
      include_headers: "false",
      batch: JSON.stringify(chunk.map((relative_url) => ({ method: "GET", relative_url }))),
    });
    const res = await fetch(`https://graph.facebook.com/${V}`, { method: "POST", body, cache: "no-store" });
    const json = await res.json();
    if (!Array.isArray(json)) throw new FbError(json.error ?? { message: "batch failed", code: -1 });
    for (const item of json) {
      if (!item) {
        out.push(new FbError({ message: "timeout", code: -2 }));
        continue;
      }
      const parsed = JSON.parse(item.body);
      out.push(parsed.error ? new FbError(parsed.error) : parsed);
    }
  }
  return out;
}

// ---------- Pages & tokens ----------

/** Fetch all pages the user token administers; persist page tokens server-side (never-expiring). */
export async function refreshPages(): Promise<{ id: string; name: string; followers?: number }[]> {
  const userToken = process.env.FB_USER_TOKEN;
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
    if (p.followers_count != null) updates[`pages/${p.id}/followers`] = p.followers_count;
  }
  await db().ref().update(updates);
  return pages.map((p) => ({ id: p.id, name: p.name, followers: p.followers_count }));
}

export async function pageToken(pageId: string): Promise<string> {
  const snap = await db().ref(`_secrets/pageTokens/${pageId}`).get();
  if (snap.exists()) return snap.val();
  if (pageId === process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN) return process.env.FB_PAGE_TOKEN;
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
  if (p.status_type === "added_photos" || p.full_picture) return { type: "photo" };
  if (p.status_type === "mobile_status_update" || p.status_type === "published_story") return { type: "text" };
  return { type: "other" };
}

export type RawCounts = { comments?: number; reactions?: number; shares?: number };

/** Lists posts published since `sinceIso`. Comment/reaction counts need pages_read_user_content; falls back without. */
export async function fetchPosts(pageId: string, token: string, sinceIso: string) {
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
  let hasCounts = true;
  try {
    rows = await list(rich);
  } catch (e) {
    if (e instanceof FbError && e.err.code === 10) {
      hasCounts = false;
      rows = await list(base);
    } else throw e;
  }
  return rows.map((p) => {
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
}

const POST_LIFETIME = "post_media_view,post_total_media_view_unique,post_video_views,post_clicks,post_reactions_by_type_total";

const val = (data: any[] | undefined, name: string, period = "lifetime") =>
  data?.find((m) => m.name === name && m.period === period)?.values?.[0]?.value;
const sumObj = (o: any) => (o && typeof o === "object" ? Object.values(o).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0);

/** Lifetime metrics for many posts (batched). */
export async function fetchPostMetrics(
  posts: { info: PostInfo; counts: RawCounts }[],
  token: string,
): Promise<Record<string, { metrics: Metrics; length?: number }>> {
  const urls: string[] = [];
  for (const { info } of posts) {
    urls.push(`${info.id}/insights?metric=${POST_LIFETIME}&period=lifetime`);
    if (info.videoId) {
      urls.push(`${info.videoId}/video_insights`);
      urls.push(`${info.videoId}?fields=length`);
    }
  }
  const res = await batch(urls, token);
  const out: Record<string, { metrics: Metrics; length?: number }> = {};
  let i = 0;
  for (const { info, counts } of posts) {
    const m = emptyMetrics();
    const ins = res[i++];
    if (!(ins instanceof FbError)) {
      m.views = val(ins.data, "post_media_view") ?? 0;
      m.reach = val(ins.data, "post_total_media_view_unique") ?? 0;
      m.videoViews = val(ins.data, "post_video_views") ?? 0;
      m.clicks = val(ins.data, "post_clicks") ?? 0;
      m.reactions = sumObj(val(ins.data, "post_reactions_by_type_total"));
    }
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

/** Daily video views per post (only videos/reels have a daily series). Range capped at 90 days by Graph. */
export async function fetchPostDaily(posts: PostInfo[], token: string, days = 30) {
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + 1);
  const urls: string[] = [];
  const targets: PostInfo[] = [];
  for (const p of posts) {
    if (!p.videoId) continue;
    const created = new Date(p.createdTime);
    const since = new Date(Math.max(created.getTime() - 86400000, until.getTime() - Math.min(days, 90) * 86400000));
    targets.push(p);
    urls.push(`${p.id}/insights?metric=post_video_views&period=day&since=${unix(since)}&until=${unix(until)}`);
  }
  const res = await batch(urls, token);
  const out: Record<string, Record<string, number>> = {};
  targets.forEach((p, i) => {
    const r = res[i];
    if (r instanceof FbError) return;
    const series = r.data?.find((m: any) => m.name === "post_video_views" && m.period === "day");
    if (!series) return;
    const byDay: Record<string, number> = {};
    for (const v of series.values) if (v.end_time) byDay[dayOf(v.end_time)] = Number(v.value) || 0;
    out[p.id] = byDay;
  });
  return out;
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
    end.setTime(since.getTime());
  }
  return out;
}
