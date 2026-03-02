# E2E tests (upload results, GET results)

Проверяют загрузку результатов и получение списка результатов через API.

## Требования

- PostgreSQL запущен (тестовая БД).
- Миграции применены (при первой настройке или после смены схемы).

## Запуск (рекомендуемый)

### 1. Поднять БД и применить миграции

```bash
cd packages/backend
docker-compose up -d postgres
# Дождаться готовности контейнера, затем:
yarn migration:run
```

### 2. Запуск e2e через tsx (рекомендуется, стабильно под Yarn PnP)

```bash
yarn test:e2e:run
```

Скрипт поднимает приложение без HTTP-сервера, выполняет запросы через supertest и проверяет: health, создание launch, загрузку результатов, GET results, GET launch со статистикой, список launches.

### 3. Запуск e2e через Vitest (при необходимости)

```bash
yarn test:e2e
# или: yarn test test/e2e/api-results.e2e.spec.ts
```

В окружении Yarn PnP Vitest может выдавать ошибку разрешения путей к entity; в таком случае используйте `yarn test:e2e:run`.

### 3. Проверка через curl (сервер должен быть запущен)

Запустите сервер в одном терминале:

```bash
yarn dev
```

В другом терминале выполните скрипт с curl:

```bash
cd packages/backend
chmod +x scripts/e2e-curl.sh
./scripts/e2e-curl.sh
```

Или вручную:

```bash
# Health
curl -s http://localhost:3000/health | jq .

# Создать launch
LAUNCH_JSON=$(curl -s -X POST http://localhost:3000/api/v1/launches \
  -H "Content-Type: application/json" \
  -d '{"name":"My Launch","environment":"test"}')
LAUNCH_ID=$(echo "$LAUNCH_JSON" | jq -r '.data.id')

# Загрузить результаты (массив TestResult)
curl -s -X POST "http://localhost:3000/api/v1/launches/${LAUNCH_ID}/results" \
  -H "Content-Type: application/json" \
  -d '[{"id":"r1","name":"Test 1","status":"passed","flaky":false,"muted":false,"known":false,"hidden":false,"labels":[],"parameters":[],"links":[],"steps":[],"sourceMetadata":{"readerId":"curl","metadata":{}}}]' | jq .

# Получить все результаты launch
curl -s "http://localhost:3000/api/v1/launches/${LAUNCH_ID}/results" | jq .

# Получить launch со статистикой
curl -s "http://localhost:3000/api/v1/launches/${LAUNCH_ID}" | jq .
```

## Что проверяют e2e-тесты

- `GET /health` — доступность и статус БД.
- `POST /api/v1/launches` — создание launch.
- `POST /api/v1/launches/:launch_id/results` — загрузка массива результатов.
- `GET /api/v1/launches/:launch_id/results` — список всех загруженных результатов (пагинация).
- `GET /api/v1/launches/:launch_id` — launch с полем `statistic` и `testResultsCount`.
- `GET /api/v1/launches` — список launches.
