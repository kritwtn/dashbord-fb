export type PageInfo = {
  id: string;
  name: string;
  enabled: boolean;
  followers?: number;
  lastSyncAt?: number;
};

export type PostInfo = {
  id: string; // full Graph id: {pageId}_{postId}
  createdTime: string; // ISO
  message: string;
  permalink: string;
  statusType: string;
  type: "reel" | "video" | "photo" | "text" | "link" | "story" | "other";
  videoId?: string;
  picture?: string;
  length?: number; // seconds
};

/** Lifetime (cumulative) metrics of a post at the moment of a sync. */
export type Metrics = {
  views: number; // post_media_view (ยอดดู)
  reach: number; // post_total_media_view_unique (ผู้ชม)
  videoViews: number; // post_video_views (>=3s)
  clicks: number;
  reactions: number;
  comments: number;
  shares: number;
  plays: number; // fb_reels_total_plays
  followersGained: number; // post_video_followers
  avgWatchMs: number;
  viewTimeMs: number;
  revenue: number; // content_monetization_earnings, USD
};

export const METRIC_KEYS: (keyof Metrics)[] = [
  "views",
  "reach",
  "videoViews",
  "clicks",
  "reactions",
  "comments",
  "shares",
  "plays",
  "followersGained",
  "avgWatchMs",
  "viewTimeMs",
  "revenue",
];

export const METRIC_LABELS: Record<keyof Metrics, string> = {
  views: "ยอดดู",
  reach: "ผู้ชม",
  videoViews: "วิดีโอวิว (3 วิ)",
  clicks: "คลิก",
  reactions: "ความรู้สึก",
  comments: "คอมเมนต์",
  shares: "แชร์",
  plays: "Reels plays",
  followersGained: "ผู้ติดตามจากโพสต์",
  avgWatchMs: "ดูเฉลี่ย (ms)",
  viewTimeMs: "เวลาดูรวม (ms)",
  revenue: "รายได้ (USD)",
};

export type SyncRun = {
  id: string;
  at: number;
  source: "api" | "csv" | "cron";
  postCount: number;
  /** posts whose metrics were re-fetched in this run (incremental sync) */
  refreshed?: number;
  dailyDays?: number;
  full?: boolean;
  error?: string;
};

export type PageDay = {
  follows?: number;
  newFollows?: number;
  mediaViews?: number;
  reach?: number;
  engagements?: number;
  videoViews?: number;
  revenue?: number; // USD
};

export const emptyMetrics = (): Metrics => ({
  views: 0,
  reach: 0,
  videoViews: 0,
  clicks: 0,
  reactions: 0,
  comments: 0,
  shares: 0,
  plays: 0,
  followersGained: 0,
  avgWatchMs: 0,
  viewTimeMs: 0,
  revenue: 0,
});

/** One day of a post: video views (>=3s) and revenue (USD) earned that day. */
export type PostDay = { v: number; r: number };
