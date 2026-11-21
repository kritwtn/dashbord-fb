import { Navigate, Outlet, useLocation } from "react-router-dom";
import { logout, useAuth } from "@/lib/auth";

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true" aria-label="กำลังโหลด">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary" />
    </div>
  );
}

/** Signed-in AND listed under /admins in the database (the rules enforce the same). */
export function RequireAdmin() {
  const { user, allowed, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (!allowed)
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-sm space-y-3 p-6 text-center">
          <div className="text-lg font-semibold">บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งาน</div>
          <p className="text-sm text-muted">{user.email} — ติดต่อผู้ดูแลระบบเพื่อเพิ่มสิทธิ์</p>
          <button className="btn w-full" onClick={() => logout()}>ออกจากระบบ</button>
        </div>
      </main>
    );
  return <Outlet />;
}
