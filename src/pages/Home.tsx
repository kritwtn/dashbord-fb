import { Navigate } from "react-router-dom";
import { listPages } from "@/lib/data";
import { useData } from "@/lib/useData";
import { FullScreenSpinner } from "./RequireAdmin";

export function Home() {
  const { data, error } = useData(listPages, []);
  if (error) return <p className="p-8 text-sm text-muted">โหลดรายชื่อเพจไม่สำเร็จ: {error}</p>;
  if (!data) return <FullScreenSpinner />;
  if (!data.length) return <p className="p-8 text-sm text-muted">ยังไม่มีเพจ — รัน <code>npm run sync -- --refresh</code></p>;
  return <Navigate to={`/p/${data[0].id}`} replace />;
}
