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
