import { useEffect, useState } from "preact/hooks";
import { getReportOptions } from "@allurereport/web-commons";

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

function getApiBase(): string {
  const opts = getReportOptions<{ apiBaseUrl?: string }>();
  if (opts?.apiBaseUrl) return opts.apiBaseUrl;
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function LaunchesPage() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBase();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `${apiBase.replace(/\/$/, "")}/api/v1/launches`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: LaunchesResponse) => {
        if (!cancelled) setLaunches(json.data ?? []);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Загрузка списка запусков…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p><strong>Ошибка:</strong> {error}</p>
        <p>Проверьте, что backend доступен по адресу: <code>{apiBase}</code></p>
        <button type="button" onClick={() => window.location.reload()}>Повторить</button>
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Нет запусков.</p>
      </div>
    );
  }

  const formatTime = (t?: string) => (t ? new Date(t).toLocaleString() : "—");
  const stat = (s?: LaunchStatistic) =>
    s ? `passed: ${s.passed ?? 0}, failed: ${s.failed ?? 0}, broken: ${s.broken ?? 0}, skipped: ${s.skipped ?? 0}` : "—";

  const reportUrl = (launchId: string) => {
    const u = new URL(window.location.href);
    u.searchParams.set("launch_id", launchId);
    return u.pathname + u.search;
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Запуски</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Имя</th>
            <th style={{ padding: "0.5rem" }}>Время старта</th>
            <th style={{ padding: "0.5rem" }}>Статистика</th>
            <th style={{ padding: "0.5rem" }}>Результатов</th>
            <th style={{ padding: "0.5rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {launches.map((launch) => (
            <tr key={launch.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.5rem" }}>{launch.name ?? launch.id}</td>
              <td style={{ padding: "0.5rem" }}>{formatTime(launch.startTime)}</td>
              <td style={{ padding: "0.5rem" }}>{stat(launch.statistic)}</td>
              <td style={{ padding: "0.5rem" }}>{launch.testResultsCount ?? "—"}</td>
              <td style={{ padding: "0.5rem" }}>
                <a href={reportUrl(launch.id)}>Открыть отчёт</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
