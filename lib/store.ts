/**
 * Minimal database interface shared by the browser (firebase/database) and the CLI (firebase-admin),
 * so the same sync/data code runs in both. Shapes mirror the admin SDK's Reference API.
 */
export type Snap = { val(): any; exists(): boolean };
export interface Ref {
  get(): Promise<Snap>;
  update(values: Record<string, unknown>): Promise<void>;
  orderByKey(): { limitToLast(n: number): { get(): Promise<Snap> } };
}
export interface Db {
  ref(path?: string): Ref;
}

let impl: Db | null = null;
export const setDb = (d: Db) => {
  impl = d;
};
export const db = (): Db => {
  if (!impl) throw new Error("database not initialised");
  return impl;
};

/** Firebase keys can't contain . # $ [ ] / */
export const safeKey = (s: string) => s.replace(/[.#$[\]/]/g, "_");
