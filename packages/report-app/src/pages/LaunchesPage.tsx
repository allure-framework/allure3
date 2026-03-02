import { useEffect, useRef, useState } from "preact/hooks";

const defaultApiBase = typeof window !== "undefined" ? window.location.origin : "";
function getApiBase(): string {
  const env = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env;
  return env?.VITE_API_BASE_URL ?? defaultApiBase;
}

/** Minimum time (ms) to show loading so e2e tests can assert on launches-loading. */
const MIN_LOADING_MS = 400;

interface LaunchStatistic {
  total?: number;
  passed?: number;
  failed?: number;
  broken?: number;
  skipped?: number;
  unknown?: number;
}

interface Launch {
  id: string;
  name?: string;
  startTime?: string;
  statistic?: LaunchStatistic;
  testResultsCount?: number;
  reportUuid?: string;
  duration?: number;
}

interface LaunchesResponse {
  data?: Launch[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export function LaunchesPage() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBase();
  const fetchStartedAt = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetchStartedAt.current = Date.now();
    setLoading(true);
    setError(null);
    const url = `${apiBase.replace(/\/$/, "")}/api/v1/launches`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: LaunchesResponse) => {
        if (!cancelled) {
          setLaunches(json.data ?? []);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message || "Load error");
        }
      })
      .finally(() => {
        if (cancelled) return;
        const elapsed = Date.now() - fetchStartedAt.current;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, remaining);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }} data-testid="launches-loading">
        <p>Loading launches…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }} data-testid="launches-error">
        <p><strong>Error:</strong> {error}</p>
        <p>Ensure the backend is available at: <code>{apiBase}</code></p>
        <button type="button" onClick={() => window.location.reload()} data-testid="launches-retry">Retry</button>
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }} data-testid="launches-empty">
        <p>No launches.</p>
      </div>
    );
  }

  const formatTime = (t?: string) => (t ? new Date(t).toLocaleString() : "—");
  const stat = (s?: LaunchStatistic) =>
    s ? `passed: ${s.passed ?? 0}, failed: ${s.failed ?? 0}, broken: ${s.broken ?? 0}, skipped: ${s.skipped ?? 0}` : "—";

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Launches</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="launches-table">
        <thead>
          <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Name</th>
            <th style={{ padding: "0.5rem" }}>Start time</th>
            <th style={{ padding: "0.5rem" }}>Statistic</th>
            <th style={{ padding: "0.5rem" }}>Results</th>
            <th style={{ padding: "0.5rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {launches.map((launch) => (
            <tr key={launch.id} style={{ borderBottom: "1px solid #eee" }} data-testid="launch-row">
              <td style={{ padding: "0.5rem" }}>{launch.name ?? launch.id}</td>
              <td style={{ padding: "0.5rem" }}>{formatTime(launch.startTime)}</td>
              <td style={{ padding: "0.5rem" }}>{stat(launch.statistic)}</td>
              <td style={{ padding: "0.5rem" }}>{launch.testResultsCount ?? "—"}</td>
              <td style={{ padding: "0.5rem" }}>
                <a href={`/report?launch_id=${encodeURIComponent(launch.id)}`} data-testid="launch-link-report">Open report</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
