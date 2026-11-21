import { useEffect, useRef, useState } from "react";
import { REFRESH_EVENT } from "./nav";

/**
 * Load async data; reloads when deps change or when router.refresh() fires.
 * - deps change (e.g. another page): clear → skeleton, never show the previous page's numbers
 * - refresh (e.g. after Sync): keep showing current data while reloading (no flash)
 */
export function useData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const lastKey = useRef<string>("");
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(REFRESH_EVENT, on);
    return () => window.removeEventListener(REFRESH_EVENT, on);
  }, []);
  useEffect(() => {
    let alive = true;
    const key = JSON.stringify(deps);
    const changed = key !== lastKey.current;
    lastKey.current = key;
    setState((s) => (changed ? { loading: true } : { ...s, error: undefined, loading: true }));
    load()
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e) => alive && setState({ error: e?.message ?? String(e), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return state;
}
