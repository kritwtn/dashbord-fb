import { readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const DB_URL =
  process.env.FIREBASE_DB_URL ??
  "https://dashboard-reels-87e0b-default-rtdb.asia-southeast1.firebasedatabase.app";

function init() {
  if (getApps().length) return getApps()[0];
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT ?? path.join(process.cwd(), "service-account.json");
  const sa = JSON.parse(readFileSync(keyPath, "utf8"));
  return initializeApp({ credential: cert(sa), databaseURL: DB_URL });
}

export const db = () => getDatabase(init());

/** Firebase keys can't contain . # $ [ ] / */
export const safeKey = (s: string) => s.replace(/[.#$[\]/]/g, "_");
