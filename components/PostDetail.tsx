"use client";
import { ArrowLeft, CircleDollarSign, ExternalLink, Eye, UserPlus } from "lucide-react";
import Link from "next/link";
import { daysBetween, num, thDate, thDay, usd } from "@/lib/format";
import type { Metrics, PostDay, PostInfo, SyncRun } from "@/lib/types";
import { DailyChart, Legend } from "./DailyChart";
import { maskPage, Thumb, useSecret } from "./Secret";
import { Dash, EmptyState, TypeBadge } from "./ui";

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

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/p/${props.pageId}/posts`} className="inline-flex items-center gap-1.5 rounded-lg px-1 text-sm text-muted transition-colors hover:text-text">
        <ArrowLeft size={15} /> โพสต์ทั้งหมด · {maskPage(secret, props.pageName, props.pageIndex)}
      </Link>

      <section className="card flex flex-col gap-5 p-5 sm:flex-row">
        <div className="shrink-0 overflow-hidden rounded-xl bg-subtle">
          <Thumb src={post.picture} type={post.type} size={148} contain />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <TypeBadge type={post.type} />
            <span>{thDate(post.createdTime)}</span>
            {post.length ? <span className="num">· {post.length} วินาที</span> : null}
          </div>
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
            <div className="card-title">วิวและรายได้รายวัน</div>
            {enoughForChart && <div className="mt-1"><Legend items={[{ label: "วิว (3 วินาที)", color: "var(--color-c1)" }, { label: "รายได้", color: "var(--color-c5)" }]} /></div>}
          </div>
        </div>
        {enoughForChart ? (
          <div className="px-2 pb-3 pt-4 sm:px-4">
            <DailyChart data={data} height={300} series={[
              { key: "views", label: "วิว", kind: "bar", color: "var(--color-c1)", labels: true },
              { key: "revenue", label: "รายได้", kind: "line", color: "var(--color-c5)", axis: "right", format: usd },
            ]} />
          </div>
        ) : null}
        {data.length ? (
          <div className="max-h-[360px] overflow-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-subtle text-xs text-muted">
                <tr><th className="px-5 py-2.5 text-left font-medium">วัน</th><th className="px-5 py-2.5 text-right font-medium">วิว</th><th className="px-5 py-2.5 text-right font-medium">สะสม</th><th className="px-5 py-2.5 text-right font-medium">รายได้</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...data].reverse().map((d) => (
                  <tr key={d.day} className="transition-colors hover:bg-hover">
                    <td className="px-5 py-2">{thDay(d.day)}</td>
                    <td className="num px-5 py-2 text-right font-medium">{num(d.views)}</td>
                    <td className="num px-5 py-2 text-right text-muted">{num(d.cum)}</td>
                    <td className="num px-5 py-2 text-right text-up">{d.revenue ? usd(d.revenue) : <Dash />}</td>
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
                  <th className="px-5 py-2.5 text-left font-medium">รอบ sync</th>
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
