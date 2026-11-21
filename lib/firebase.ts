import { readFileSync } from "node:fs";
import path from "node:path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const DB_URL =
  process.env.FIREBASE_DB_URL ??
  "https://dashboard-reels-87e0b-default-rtdb.asia-southeast1.firebasedatabase.app";

/** Service account from FIREBASE_SERVICE_ACCOUNT_JSON (hosting) or ./service-account.json (local). */
function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT ?? path.join(process.cwd(), "service-account.json");
  return JSON.parse(readFileSync(keyPath, "utf8"));
}

// On Cloud Functions / Cloud Run the runtime service account is used (no key file deployed).
const onGcp = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET);

export function app() {
  return (
    getApps()[0] ??
    initializeApp({
      credential: onGcp && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? applicationDefault() : cert(serviceAccount()),
      projectId: "dashboard-reels-87e0b",
      databaseURL: DB_URL,
    })
  );
}

export const db = () => getDatabase(app());

/** Firebase keys can't contain . # $ [ ] / */
export const safeKey = (s: string) => s.replace(/[.#$[\]/]/g, "_");
