import { useState } from "react";
import { ArrowLeft, CalendarDays, CircleDollarSign, Clock, ExternalLink, Eye, Maximize2, Minimize2, UserPlus } from "lucide-react";
import Link from "@/lib/nav";
import { ageLabel, daysBetween, metaDayInBkk, num, thDate, thDateParts, thDay, usd } from "@/lib/format";
import type { Metrics, PostDay, PostInfo, SyncRun } from "@/lib/types";
import { DailyChart, Legend } from "./DailyChart";
import { maskPage, Thumb, useSecret } from "./Secret";
import { Dash, EmptyState, MetaDay, ThaiTime, TypeBadge } from "./ui";

const SECONDARY: { k: keyof Metrics; label: string }[] = [
  { k: "reach", label: "ผู้ชม" },
  { k: "videoViews", label: "วิดีโอวิว (3 วิ)" },
  { k: "plays", label: "Reels plays" },
  { k: "avgWatchMs", label: "ดูเฉลี่ย (วิ)" },
  { k: "reactions", label: "ความรู้สึก" },
  { k: "comments", label: "คอมเมนต์" },
  { k: "shares", label: "แชร์" },
  { k: "clicks", label: "คลิก" },
];
const HISTORY: { k: keyof Metrics; label: string }[] = [
  { k: "views", label: "ยอดดู" },
  { k: "reach", label: "ผู้ชม" },
  { k: "reactions", label: "ความรู้สึก" },
  { k: "comments", label: "คอมเมนต์" },
  { k: "shares", label: "แชร์" },
  { k: "followersGained", label: "ผู้ติดตาม" },
  { k: "revenue", label: "รายได้" },
];

const fmt = (k: keyof Metrics, v: number | undefined) =>
  v == null || Number.isNaN(v) ? null : k === "revenue" ? usd(v) : k === "avgWatchMs" ? `${(v / 1000).toFixed(1)}` : num(v);

export function PostDetail(props: {
  pageId: string; pageName: string; pageIndex: number; post: PostInfo; latest: Metrics | null;
  daily: Record<string, PostDay>; snapshots: { sync: SyncRun; m: Metrics }[]; postNo: number;
}) {
  const { post, latest, daily, snapshots } = props;
  const { on: secret } = useSecret();
  const [showAll, setShowAll] = useState(false);
  const days = Object.keys(daily).sort();
  let cum = 0;
  const data = days.length
    ? daysBetween(days[0], days.at(-1)!).map((day) => {
        const d = daily[day];
        cum += d?.v ?? 0;
        return { day, views: d?.v ?? 0, revenue: d?.r ?? 0, cum };
      })
    : [];
  const enoughForChart = data.length > 3;
  const canExpand = enoughForChart; // a phone already scrolls at 4 days

  return (
    <div className="fade-in mx-auto max-w-[1100px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/p/${props.pageId}/posts`} className="inline-flex items-center gap-1.5 rounded-lg px-1 text-sm text-muted transition-colors hover:text-text">
        <ArrowLeft size={15} /> โพสต์ทั้งหมด · {maskPage(secret, props.pageName, props.pageIndex)}
      </Link>

      <section className="card flex flex-col gap-5 p-5 sm:flex-row">
        <div className="shrink-0 overflow-hidden rounded-xl bg-subtle">
          <Thumb src={post.picture} type={post.type} size={148} contain />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {(() => {
            const t = thDateParts(post.createdTime);
            return (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-ink"><CalendarDays size={20} /></span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-primary-text">โพสต์เมื่อ</div>
                  <div className="text-base font-semibold leading-snug text-text sm:text-lg">
                    {t.date} <span className="whitespace-nowrap">เวลา <span className="num">{t.time}</span></span>
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <ThaiTime />
                  <span className="badge bg-surface text-muted"><Clock size={12} />{ageLabel(post.createdTime)}ที่แล้ว</span>
                </div>
              </div>
            );
          })()}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <TypeBadge type={post.type} />
            {post.length ? <span className="num">ความยาว {post.length} วินาที</span> : null}
          </div>
          <h1 className="sr-only">{secret ? `โพสต์ #${props.postNo}` : "รายละเอียดโพสต์"}</h1>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {secret ? `โพสต์ #${props.postNo}` : post.message || <span className="text-muted">(ไม่มีข้อความ)</span>}
          </p>
          {!secret && post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="btn h-8 text-[13px]">
              เปิดบน Facebook <ExternalLink size={14} />
            </a>
          )}
        </div>
      </section>

      {latest ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { k: "views" as const, label: "ยอดดูรวม", icon: Eye, color: "var(--color-c1)" },
              { k: "followersGained" as const, label: "ผู้ติดตามจากโพสต์", icon: UserPlus, color: "var(--color-c4)" },
              { k: "revenue" as const, label: "รายได้รวม", icon: CircleDollarSign, color: "var(--color-c5)" },
            ].map((h) => (
              <div key={h.k} className="card p-5">
                <div className="flex items-center gap-2 text-[13px] font-medium text-muted"><h.icon size={15} style={{ color: h.color }} />{h.label}</div>
                <div className="num mt-3 text-[28px] font-semibold leading-none tracking-tight">{fmt(h.k, latest[h.k]) ?? <Dash />}</div>
              </div>
            ))}
          </section>
          <section className="card grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
            {SECONDARY.map((s) => (
              <div key={s.k} className="bg-surface px-4 py-3.5">
                <div className="text-xs font-medium text-muted">{s.label}</div>
                <div className="num mt-1 text-lg font-semibold">{fmt(s.k, latest[s.k]) ?? <Dash />}</div>
              </div>
            ))}
          </section>
        </>
      ) : null}

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-2">วิวและรายได้รายวัน <MetaDay /></div>
            {enoughForChart && <div className="mt-1"><Legend items={[{ label: "วิว (3 วินาที)", color: "var(--color-c1)" }, { label: "รายได้", color: "var(--color-c5)" }]} /></div>}
          </div>
          {canExpand && (
            <button type="button" className={`btn h-8 shrink-0 whitespace-nowrap text-[13px] ${data.length > 6 ? "" : "sm:hidden"}`} aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? <><Minimize2 size={14} /> ย่อ</> : <><Maximize2 size={14} /> แสดงทั้งหมด</>}
            </button>
          )}
        </div>
        {enoughForChart ? (
          <div className="px-2 pb-3 pt-4 sm:px-4">
            <DailyChart data={data} height={showAll ? 340 : 300} fit={showAll} series={[
              { key: "views", label: "วิว", kind: "bar", color: "var(--color-c1)", labels: true },
              { key: "revenue", label: "รายได้", kind: "line", color: "var(--color-c5)", axis: "right", format: usd },
            ]} />
          </div>
        ) : null}
        {data.length ? (
          <div className={`border-t border-line ${showAll ? "overflow-x-auto" : "max-h-[360px] overflow-auto"}`}>
            <table className="w-full text-sm">
              <thead className={`bg-subtle text-xs text-muted ${showAll ? "" : "sticky top-0"}`}>
                <tr><th className="px-3 py-2.5 sm:px-5 text-left font-medium">วัน</th><th className="px-3 py-2.5 sm:px-5 text-right font-medium">วิว</th><th className="px-3 py-2.5 sm:px-5 text-right font-medium">สะสม</th><th className="px-3 py-2.5 sm:px-5 text-right font-medium">รายได้</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...data].reverse().map((d) => (
                  <tr key={d.day} className="transition-colors hover:bg-hover">
                    <td className="px-3 py-2 sm:px-5">
                      {(() => {
                        const r = metaDayInBkk(d.day);
                        return (
                          <>
                            <div>{thDay(d.day)}</div>
                            <div className="num text-[11px] text-muted">
                              <span className="whitespace-nowrap">{thDay(r.start.day)} {r.start.time} –</span>{" "}
                              <span className="whitespace-nowrap">{thDay(r.end.day)} {r.end.time} น.</span>
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="num px-3 py-2 text-right sm:px-5 font-medium">{num(d.views)}</td>
                    <td className="num px-3 py-2 text-right sm:px-5 text-muted">{num(d.cum)}</td>
                    <td className="num px-3 py-2 text-right sm:px-5 text-up">{d.revenue ? usd(d.revenue) : <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="ยังไม่มีข้อมูลรายวัน" hint={post.type === "story" ? "สตอรี่ไม่มีข้อมูลรายวันจาก Meta" : "กด Sync เพื่อดึงข้อมูล"} />}
      </section>

      {snapshots.length > 0 && (
        <section className="card overflow-hidden">
          <div className="card-header"><div className="card-title">ประวัติแต่ละรอบ sync</div></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">รอบ sync (เวลาไทย)</th>
                  {HISTORY.map((h) => <th key={h.k} className="whitespace-nowrap px-4 py-2.5 text-right font-medium">{h.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...snapshots].reverse().map(({ sync, m }, i, arr) => {
                  const before = arr[i + 1]?.m;
                  return (
                    <tr key={sync.id} className="transition-colors hover:bg-hover">
                      <td className="whitespace-nowrap px-5 py-2.5">{thDate(new Date(sync.at).toISOString())}</td>
                      {HISTORY.map(({ k }) => {
                        const v = m[k];
                        const pv = before?.[k];
                        const d = typeof v === "number" && typeof pv === "number" ? v - pv : null;
                        return (
                          <td key={k} className="num whitespace-nowrap px-4 py-2.5 text-right">
                            {fmt(k, v) ?? <Dash />}
                            {d != null && Math.abs(d) > (k === "revenue" ? 0.004 : 0) && (
                              <span className={`ml-1.5 text-xs ${d > 0 ? "text-up" : "text-down"}`}>{d > 0 ? "+" : ""}{k === "revenue" ? d.toFixed(2) : num(d)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
