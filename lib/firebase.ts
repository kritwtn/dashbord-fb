/** Node-only (CLI scripts): firebase-admin with the service account. Never imported by the web app. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { setDb, type Db } from "./store";

const DB_URL =
  process.env.FIREBASE_DB_URL ?? "https://dashboard-reels-87e0b-default-rtdb.asia-southeast1.firebasedatabase.app";

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT ?? path.join(process.cwd(), "service-account.json");
  return JSON.parse(readFileSync(keyPath, "utf8"));
}

export function app() {
  return getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()), databaseURL: DB_URL });
}

/** Point the shared store at firebase-admin. */
export function useAdminDb() {
  setDb(getDatabase(app()) as unknown as Db);
}
