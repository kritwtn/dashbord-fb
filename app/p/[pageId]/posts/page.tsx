import { notFound } from "next/navigation";
import { PostsView } from "@/components/PostsView";
import { requireUser } from "@/lib/auth";
import { loadPage } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PostsPage({ params }: { params: Promise<{ pageId: string }> }) {
  await requireUser();
  const { pageId } = await params;
  const bundle = await loadPage(pageId);
  if (!bundle) notFound();
  return <PostsView b={bundle} />;
}
