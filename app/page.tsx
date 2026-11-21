import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listPages } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser();
  const pages = await listPages();
  if (!pages.length) return <p className="p-8">ยังไม่มีเพจ — รัน <code>npm run sync -- --refresh</code></p>;
  redirect(`/p/${pages[0].id}`);
}
