import { useCallback, useEffect, useState } from "react";

interface UseTabDataOpts {
  autoRefreshMs?: number;
  enabled?: boolean;
}

export function useTabData<T>(endpoint: string, opts: UseTabDataOpts = {}) {
  const { autoRefreshMs, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as T;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
  }, [endpoint, enabled, refetch]);

  useEffect(() => {
    if (!autoRefreshMs || !enabled) return;
    const id = setInterval(refetch, autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, refetch, enabled]);

  return { data, loading, error, refetch };
}
