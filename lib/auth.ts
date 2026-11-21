import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "firebase-admin/auth";
import { app } from "./firebase";

export const SESSION_COOKIE = "session";
const SESSION_MS = 7 * 24 * 3600 * 1000;

/** Optional extra guard: comma-separated emails in ALLOWED_EMAILS. Empty = any user that exists in Firebase Auth. */
export function isAllowed(email?: string | null) {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !list.length || (!!email && list.includes(email.toLowerCase()));
}

export async function createSession(idToken: string) {
  const auth = getAuth(app());
  const decoded = await auth.verifyIdToken(idToken);
  if (!isAllowed(decoded.email)) throw new Error("not allowed");
  return { cookie: await auth.createSessionCookie(idToken, { expiresIn: SESSION_MS }), maxAge: SESSION_MS / 1000 };
}

export async function getUser() {
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!c) return null;
  try {
    const u = await getAuth(app()).verifySessionCookie(c, true);
    return isAllowed(u.email) ? u : null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
