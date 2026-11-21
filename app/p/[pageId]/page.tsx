import { notFound } from "next/navigation";
import { Overview } from "@/components/Overview";
import { requireUser } from "@/lib/auth";
import { listPages, loadPage } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ pageId: string }> }) {
  await requireUser();
  const { pageId } = await params;
  const [pages, bundle] = await Promise.all([listPages(), loadPage(pageId)]);
  if (!bundle) notFound();
  return <Overview b={bundle} pageIndex={Math.max(0, pages.findIndex((p) => p.id === pageId))} />;
}
