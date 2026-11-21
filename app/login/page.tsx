"use client";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientAuth } from "@/lib/firebase-client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const auth = clientAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
      await signOut(auth); // the server session cookie is the source of truth
      if (!res.ok) throw new Error((await res.json()).error ?? "เข้าสู่ระบบไม่สำเร็จ");
      router.replace("/");
      router.refresh();
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
    <main className="flex min-h-screen items-center justify-center px-4">
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
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
        </label>
        {err && <p role="alert" className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-text">{err}</p>}
        <button className="btn btn-primary h-10 w-full" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}
