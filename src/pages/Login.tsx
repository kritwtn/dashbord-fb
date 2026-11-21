import { browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase-client";
import { ThemeToggle } from "@/components/Theme";

const EMAIL_KEY = "remember-email";
const readSaved = () => {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
};

export function Login() {
  const { user, allowed, ready } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const saved = readSaved();
  const [email, setEmail] = useState(saved ?? "");
  const [remember, setRemember] = useState(saved !== "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && user && allowed) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      // remember me: stay signed in across browser restarts and prefill the email next time;
      // otherwise the session ends when the browser closes and the email is forgotten.
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      try {
        // "" marks an explicit opt-out so the checkbox stays unticked next time
        localStorage.setItem(EMAIL_KEY, remember ? email.trim() : "");
      } catch {}
      navigate(from, { replace: true });
    } catch (e: any) {
      const code: string = e?.code ?? "";
      setErr(code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
        ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        : code.includes("too-many-requests") ? "ลองผิดหลายครั้งเกินไป กรุณารอสักครู่" : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="card w-full max-w-[380px] space-y-5 p-7">
        <div className="space-y-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-ink">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">เข้าสู่ระบบ Reels Insight</h1>
            <p className="mt-1 text-sm text-muted">ใช้บัญชีที่ผู้ดูแลระบบสร้างให้</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="label">อีเมล</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
        </label>
        <label className="block space-y-1.5">
          <span className="label">รหัสผ่าน</span>
          <input type="password" required autoComplete="current-password" autoFocus={!!saved} value={password}
            onChange={(e) => setPassword(e.target.value)} className="input w-full" />
        </label>
        <label htmlFor="remember" className="flex select-none items-start gap-2.5 text-sm">
          <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
          <span>
            จดจำฉันไว้
            <span className="block text-xs text-muted">จำอีเมล และไม่ต้องเข้าสู่ระบบใหม่เมื่อปิดเบราว์เซอร์</span>
          </span>
        </label>
        {err && <p role="alert" className="rounded-lg bg-down-soft px-3 py-2 text-sm text-down">{err}</p>}
        <button className="btn btn-primary h-10 w-full" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}
