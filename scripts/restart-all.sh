#!/usr/bin/env bash
# Restart backend (3000) and report-app (8080) for quick verification after fixes.
# Usage: ./restart-all.sh [--nginx] [--build]
#   --nginx: use pre-built frontend (report-app serve, proxies /api/ to backend). Otherwise use Vite dev.
#   --build: rebuild frontend before starting (web-components, report-app). Use with --nginx.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USE_NGINX=false
DO_BUILD=false
for arg in "$@"; do
  if [ "$arg" = "--nginx" ]; then
    USE_NGINX=true
  elif [ "$arg" = "--build" ]; then
    DO_BUILD=true
  fi
done

echo "Stopping processes on ports 3000 and 8080..."
for port in 3000 8080; do
  pid=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    echo "  Port $port freed."
  fi
done
echo "Stopping nginx container (if running)..."
docker compose -f docker-compose.report.yml down 2>/dev/null || true
sleep 2
# Wait for port 8080 to be free (needed for Vite when not using nginx)
for i in 1 2 3 4 5; do
  if ! lsof -i :8080 >/dev/null 2>&1; then
    break
  fi
  echo "  Waiting for port 8080 to be released..."
  sleep 1
done

echo "Starting PostgreSQL (if not running)..."
docker compose -f packages/backend/docker-compose.yml up -d postgres 2>/dev/null || true
# Wait for PostgreSQL to be ready (healthcheck or simple retry)
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose -f packages/backend/docker-compose.yml exec -T postgres pg_isready -U allure 2>/dev/null; then
    echo "  PostgreSQL ready."
    break
  fi
  echo "  Waiting for PostgreSQL... ($i/10)"
  sleep 2
done

echo "Building web-commons..."
yarn workspace @allurereport/web-commons run build

if [ "$USE_NGINX" = true ]; then
  if [ "$DO_BUILD" = true ]; then
    echo "Building web-components..."
    yarn workspace @allurereport/web-components run build
    echo "Building web-awesome..."
    yarn workspace @allurereport/web-awesome run build:prod:multi
    echo "Building report-app (Launches + report.html)..."
    yarn workspace @allurereport/report-app run build
  fi
  echo "Starting backend (port 3000)..."
  yarn workspace @allurereport/backend run dev &
  BACKEND_PID=$!
  sleep 2
  echo "Starting report-app serve (port 8080, Launches + Report)..."
  yarn workspace @allurereport/report-app run serve &
  WEB_PID=$!
  echo "Done. Backend PID=$BACKEND_PID, Web PID=$WEB_PID"
  echo "  Backend: http://localhost:3000  |  Frontend: http://localhost:8080"
  echo "  Report (pre-built): http://localhost:8080/report?launch_id=..."
else
  echo "Building web-awesome..."
  yarn workspace @allurereport/web-awesome run build:prod:multi
  echo "Building report-app (Launches + Report)..."
  yarn workspace @allurereport/report-app run build
  echo "Starting backend (port 3000)..."
  yarn workspace @allurereport/backend run dev &
  BACKEND_PID=$!
  sleep 2
  echo "Starting report-app (port 8080, Launches + Report)..."
  yarn workspace @allurereport/report-app run serve &
  WEB_PID=$!
  echo "Done. Backend PID=$BACKEND_PID, Web PID=$WEB_PID"
  echo "  Backend: http://localhost:3000  |  Frontend: http://localhost:8080"
  echo "  Report: http://localhost:8080/report?launch_id=..."
fi
echo ""
echo "  If you see 'No launches': load demo data first:"
echo "    yarn workspace @allurereport/backend run load-demo"
echo "    Or parent+children: yarn workspace @allurereport/backend run load-demo-parent"
echo "    Or parent+empty child (provisioning failed): yarn workspace @allurereport/backend run load-demo-parent-empty-child"
