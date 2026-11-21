import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AudienceView } from "@/components/AudienceView";
import { Overview } from "@/components/Overview";
import { PostDetail } from "@/components/PostDetail";
import { PostsView } from "@/components/PostsView";
import { ErrorState } from "@/components/ui";
import { REFRESH_EVENT } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { listPages, loadAudience, loadPage, loadPost, recentSyncs } from "@/lib/data";
import type { PageInfo } from "@/lib/types";
import { useData } from "@/lib/useData";
import { PageSkeleton } from "./Skeleton";

type Ctx = { pages: PageInfo[]; pageIndex: number };

export function PageLayout() {
  const { pageId = "" } = useParams();
  const { user } = useAuth();
  const pages = useData(listPages, []);
  const syncs = useData(() => recentSyncs(pageId, 8), [pageId]);
  const list = pages.data ?? [];
  const pageIndex = Math.max(0, list.findIndex((p) => p.id === pageId));
  return (
    <AppShell pages={list} pageId={pageId} email={user?.email ?? ""} syncs={syncs.data ?? []}>
      <Outlet context={{ pages: list, pageIndex } satisfies Ctx} />
    </AppShell>
  );
}

const Failed = ({ error }: { error: string }) => (
  <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
    <div className="card"><ErrorState detail={error} onRetry={() => window.dispatchEvent(new Event(REFRESH_EVENT))} /></div>
  </div>
);

export function OverviewPage() {
  const { pageId = "" } = useParams();
  const { pageIndex } = useOutletContext<Ctx>();
  const { data, error } = useData(() => loadPage(pageId), [pageId]);
  if (error) return <Failed error={error} />;
  if (!data) return <PageSkeleton />;
  return <Overview key={pageId} b={data} pageIndex={pageIndex} />;
}

export function PostsPage() {
  const { pageId = "" } = useParams();
  const { data, error } = useData(() => loadPage(pageId), [pageId]);
  if (error) return <Failed error={error} />;
  if (!data) return <PageSkeleton />;
  return <PostsView key={pageId} b={data} />;
}

export function PostPage() {
  const { pageId = "", postKey = "" } = useParams();
  const { pageIndex } = useOutletContext<Ctx>();
  const key = decodeURIComponent(postKey);
  const { data, error } = useData(() => loadPost(pageId, key), [pageId, key]);
  if (error) return <Failed error={error} />;
  if (!data) return <PageSkeleton />;
  return (
    <PostDetail pageId={pageId} pageName={data.page?.name ?? ""} pageIndex={pageIndex}
      post={data.post} latest={data.latest} daily={data.daily} snapshots={data.snapshots} postNo={data.postNo} />
  );
}

export function AudiencePage() {
  const { pageId = "" } = useParams();
  const { pages, pageIndex } = useOutletContext<Ctx>();
  const { data, error } = useData(() => loadAudience(pageId), [pageId]);
  if (error) return <Failed error={error} />;
  if (!data) return <PageSkeleton />;
  return <AudienceView key={pageId} data={data} pageName={pages[pageIndex]?.name ?? ""} pageIndex={pageIndex} />;
}
