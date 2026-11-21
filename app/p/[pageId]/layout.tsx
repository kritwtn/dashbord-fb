import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { listPages, recentSyncs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ pageId: string }> }) {
  const user = await requireUser();
  const { pageId } = await params;
  const [pages, syncs] = await Promise.all([listPages(), recentSyncs(pageId, 8)]);
  return (
    <AppShell pages={pages} pageId={pageId} email={user.email ?? ""} syncs={syncs}>
      {children}
    </AppShell>
  );
}
