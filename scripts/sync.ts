/**
 * CLI sync, usable from cron:  npm run sync               (all enabled pages)
 *                              npm run sync -- <pageId>…   (specific pages)
 *                              npm run sync -- --full      (backfill since first post)
 *                              npm run sync -- --refresh   (only refresh page list/tokens)
 */
import { refreshPages } from "../lib/fb";
import { syncPages } from "../lib/sync";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--refresh")) {
    const pages = await refreshPages();
    for (const p of pages) console.log(p.id, p.name, p.followers ?? "");
    process.exit(0);
  }
  const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1];
  const days = daysArg ? Number(daysArg) : undefined; // default: since last sync
  const ids = args.filter((a) => !a.startsWith("--"));
  const results = await syncPages(ids.length ? ids : "enabled", { source: "cron", dailyDays: days, full: args.includes("--full") });
  for (const r of results) console.log(r.pageId, r.error ? `ERROR ${r.error}` : `ok ${r.run!.postCount} posts (${r.run!.id})`);
  if (!results.length) console.log("No enabled pages. Enable pages in the dashboard first.");
  process.exit(results.some((r) => r.error) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
