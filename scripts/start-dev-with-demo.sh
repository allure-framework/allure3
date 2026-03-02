#!/usr/bin/env bash
# Start DB + Backend + Frontend, load test data, open browser.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Starting DB (Postgres + Redis) ==="
cd packages/backend && docker-compose up -d postgres redis 2>/dev/null || docker compose up -d postgres redis 2>/dev/null || true
cd "$ROOT"

echo "=== 2. Running migrations ==="
yarn workspace @allurereport/backend run migration:run

echo "=== 3. Stopping any existing processes on 3000 and 8080 ==="
for port in 3000 8080; do
  pid=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
done
docker compose -f docker-compose.report.yml down 2>/dev/null || true

echo "=== 4. Starting backend (port 3000) ==="
yarn workspace @allurereport/backend run dev &
BACKEND_PID=$!

echo "Waiting for backend health..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null | grep -q 200; then
    echo "Backend ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Backend failed to start"
    exit 1
  fi
  sleep 1
done

echo "=== 5. Loading test data ==="
DEMO_DIR="$ROOT/packages/backend/test/fixtures/demo-results"
if [ -d "$DEMO_DIR" ]; then
  DATA_DIR="$DEMO_DIR" yarn workspace @allurereport/backend run load-demo
else
  echo "Demo fixtures not found at $DEMO_DIR, trying default load-demo..."
  yarn workspace @allurereport/backend run load-demo || echo "load-demo failed (no demo data?), continuing..."
fi

echo "=== 6. Building and starting frontend (port 8080, pre-built web-awesome) ==="
yarn workspace @allurereport/web-commons run build
yarn workspace @allurereport/report-app run build
yarn workspace @allurereport/report-app run serve &
WEB_PID=$!

echo "Waiting for frontend..."
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null | grep -qE '200|301|302'; then
    echo "Frontend ready."
    break
  fi
  sleep 1
done

echo "=== 7. Opening in Cursor Simple Browser ==="
(sleep 2 && (cursor "vscode://vscode-simple-browser/simpleBrowser?url=http://localhost:8080" 2>/dev/null || echo "Open http://localhost:8080 in Cursor (Cmd+Shift+P -> Simple Browser: Show)")) &

echo ""
echo "Done. Backend: http://localhost:3000 | Frontend: http://localhost:8080"
echo "Press Ctrl+C to stop backend and frontend (DB will keep running)."

wait
