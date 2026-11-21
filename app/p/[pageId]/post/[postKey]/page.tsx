import { notFound } from "next/navigation";
import { PostDetail } from "@/components/PostDetail";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { listPages, loadPost } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ pageId: string; postKey: string }> }) {
  await requireUser();
  const { pageId, postKey } = await params;
  const key = decodeURIComponent(postKey);
  const [pages, d, all] = await Promise.all([listPages(), loadPost(pageId, key), db().ref(`posts/${pageId}`).get()]);
  if (!d) notFound();
  // masked number (#1 = oldest) for secret mode, consistent with the lists
  const order = Object.entries<any>(all.val() ?? {}).sort((a, b) => a[1].createdTime.localeCompare(b[1].createdTime));
  const postNo = order.findIndex(([k]) => k === key) + 1;
  return (
    <PostDetail pageId={pageId} pageName={d.page?.name ?? ""} pageIndex={Math.max(0, pages.findIndex((p) => p.id === pageId))}
      post={d.post} latest={d.latest} daily={d.daily} snapshots={d.snapshots} postNo={postNo} />
  );
}
