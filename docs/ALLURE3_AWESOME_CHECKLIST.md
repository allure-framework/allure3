# Allure 3 Awesome — чек-лист базового функционала

Обзор по проекту allure3 (web-awesome + plugin-awesome + backend API). Отдельные списки для **Backend** и **Frontend**; отмечено, что уже реализовано и что ещё нужно.

---

## Backend (API)

### Launches

| Функционал | Статус | Примечание |
|------------|--------|------------|
| POST /api/v1/launches (создание) | ✅ | name, executor, environment, variables; parent_launch_id, run_key, environment_name |
| GET /api/v1/launches (список) | ✅ | Пагинация, фильтры по датам |
| GET /api/v1/launches/:id | ✅ | Детали + statistic, testResultsCount |
| GET /api/v1/launches/:id/environments | ✅ | Дочерние launch как среды или сам launch |
| POST /api/v1/launches/:id/complete | ✅ | |
| DELETE /api/v1/launches/:id | ✅ | ON DELETE SET NULL для дочерних |

### Test results

| Функционал | Статус | Примечание |
|------------|--------|------------|
| POST /api/v1/launches/:id/results (загрузка) | ✅ | Массив TestResult DTO |
| GET /api/v1/launches/:id/results | ✅ | Список с пагинацией, опция ?environment= |
| GET /api/v1/test-results/:id | ✅ | Один результат по id |
| GET /api/v1/test-results/:id/history | ✅ | История по testCaseId/historyId |
| GET /api/v1/test-results/search | ✅ | По статусу, лейблам и т.д. |

### Trees (деревья для вкладок Suites / Packages / Behaviors / Categories)

| Функционал | Статус | Примечание |
|------------|--------|------------|
| GET /api/v1/trees/suites?launch_id=&environment= | ✅ | |
| GET /api/v1/trees/packages?launch_id=&environment= | ✅ | |
| GET /api/v1/trees/behaviors?launch_id=&environment= | ✅ | |
| GET /api/v1/trees/categories?launch_id=&environment= | ✅ | Агрегация по дочерним launch при parent |

### Widgets (виджеты для сводки и графиков)

| Функционал | Статус | Примечание |
|------------|--------|------------|
| GET /api/v1/widgets/summary?launch_id=&environment= | ✅ | statistic, duration, flaky, retries |
| GET /api/v1/widgets/status?launch_id=&environment= | ✅ | Статистика по статусам |
| GET /api/v1/widgets/duration, flaky, retries | ✅ | Реализованы в WidgetService |
| GET /api/v1/widgets/timeline?launch_id= | ✅ | Массив тестов с start/duration/host/thread |
| GET /api/v1/widgets/globals?launch_id= | ✅ | PluginGlobals (exitCode, errors, attachments) |
| GET /api/v1/widgets/tree-filters?launch_id= | ✅ | Уникальные теги из labels name='tag' |
| GET /api/v1/widgets/variables?launch_id=&environment= | ✅ | Record<string, string>, per-env merge |
| GET /api/v1/widgets/allure_environment?launch_id= | ✅ | EnvironmentItem[] из launch_globals |
| GET /api/v1/widgets/quality-gate?launch_id= | ✅ | Заглушка `[]` (ветка в GetWidgetData + маппинг в apiReportClient) |
| POST /api/v1/launches/:id/widgets/generate | ✅ | Генерация виджетов по результатам |
| POST /api/v1/launches/:id/globals | ✅ | Загрузка exitCode, errors, allureEnvironment |
| POST /api/v1/launches/:id/variables | ✅ | Merge переменных |

### Attachments

| Функционал | Статус | Примечание |
|------------|--------|------------|
| POST /api/v1/launches/:id/attachments | ✅ | Загрузка файла |
| GET /api/v1/attachments/:uid | ✅ | Скачивание по uid |
| DELETE /api/v1/attachments/:uid | ✅ | |

### Reports (генерация отчётов)

| Функционал | Статус | Примечание |
|------------|--------|------------|
| POST /api/v1/launches/:id/reports/generate | ✅ | format, ?environment= |
| GET /api/v1/reports/:uuid, download | ⚠️ | Заглушка 404 (TODO в коде) |

---

### Что на бэкенде ещё нужно для полного Awesome API-режима

| Эндпоинт / данные | Назначение | Приоритет |
|-------------------|------------|-----------|
| **Environments для API** | Реализовано: ApiReportClient вызывает GET /launches/:id/environments, возвращает массив id для переключателя сред | — |
| **Charts** | GET /widgets/summary маппится в charts через адаптер; при необходимости отдельный формат «charts» (несколько графиков) | Низкий |

---

## Frontend (web-awesome + report-app + web-commons)

### Режим данных (статический отчёт vs API)

| Функционал | Статус | Примечание |
|------------|--------|------------|
| Выбор клиента (StaticReportClient / ApiReportClient) | ✅ | По allureReportOptions.apiBaseUrl |
| Маппинг путей API → backend URL (getApiReportUrl) | ✅ | trees, widgets (summary, status, timeline, globals, tree-filters, variables, allure_environment), nav, test-results, attachments |
| Заглушки в API-режиме: environments | ✅ | environments → ["default"]; tree-filters, variables, timeline, globals, allure_environment — реальные данные с бэкенда |
| Адаптеры ответов бэкенда (adaptTreeResponse, adaptWidgetToStatistic, …) | ✅ | backendAdapters.ts |
| Сброс кэша клиента при смене опций (clearReportClientCache) | ✅ | ReportPage вызывает при установке apiBaseUrl/launchId |

### Секции и навигация

| Секция | Статус | Данные |
|--------|--------|--------|
| **Results (Report)** — вкладки Suites, Packages, Behaviors, Categories | ✅ | Деревья через widgets/{env}/tree.json → GET /trees/:type |
| **Charts (Graphs)** | ✅ | widgets/charts.json → маппится на summary, адаптер ChartsResponse |
| **Timeline** | ✅ | widgets/timeline.json → GET /widgets/timeline; данные с бэкенда |

### Загрузка данных при старте (prefetch)

| Данные | Статус | API / заглушка |
|--------|--------|----------------|
| Report stats (statistic.json) | ✅ | GET /widgets/status |
| Pie chart (statistic / pie_chart) | ✅ | GET /widgets/status |
| Environments (environments.json) | ✅ | GET /launches/:id/environments; массив id для переключателя сред |
| Env info (allure_environment.json) | ✅ | GET /widgets/allure_environment; загрузка через POST /launches/:id/globals |
| Globals (globals.json) | ✅ | GET /widgets/globals; загрузка через POST /launches/:id/globals |
| Quality gate (quality-gate.json) | ✅ | Заглушка `[]` (GET /widgets/quality-gate) |
| Tree filters (tree-filters.json) | ✅ | GET /widgets/tree-filters; теги из labels name='tag' |
| Variables (variables.json, widgets/:env/variables.json) | ✅ | GET /widgets/variables; POST /launches с variables, POST /launches/:id/variables |
| Деревья по средам (widgets/:env/tree.json и т.д.) | ✅ | GET /trees/:type?launch_id=&environment= |
| Nav (id тестов для списка) | ✅ | GET /launches/:id/results → adaptNavResponse |
| Конкретный тест (data/test-results/:id.json) | ✅ | GET /test-results/:id + adaptTestResultToClassic |
| Вложения (attachments/:uid) | ✅ | GET /attachments/:uid |

### UI компоненты Awesome

| Компонент / экран | Статус | Примечание |
|-------------------|--------|------------|
| Header, SectionPicker, CiInfo | ✅ | |
| Дерево (Suites/Packages/Behaviors/Categories), фильтры, сортировка | ✅ | |
| Карточка теста (шаги, вложения, параметры, ссылки, ретраи, история) | ✅ | Зависит от формата test result с бэка |
| Timeline виджет | ✅ | Данные из GET /widgets/timeline |
| Charts (графики) | ✅ | Данные из summary/charts адаптера |
| Переключатель сред (environments) | ✅ | Данные из GET /launches/:id/environments |
| Фильтр по тегам (tree filters) | ✅ | Данные из GET /widgets/tree-filters |
| Локализация (i18n) | ✅ | |
| Тема (светлая/тёмная) | ✅ | |

### report-app (точка входа для API-режима)

| Функционал | Статус | Примечание |
|------------|--------|------------|
| Страница списка запусков (LaunchesPage) | ✅ | GET /api/v1/launches |
| Страница отчёта (ReportPage) по ?launch_id= | ✅ | Установка allureReportOptions.apiBaseUrl, launchId |
| Дефолт apiBaseUrl в dev (localhost:3000) | ✅ | При порте 5174/4173 |
| Роутинг /report, / | ✅ | |

---

## Что на фронте ещё нужно для полного Awesome в API-режиме

| Задача | Описание | Приоритет |
|--------|----------|-----------|
| **Обработка ошибок загрузки** | Часть данных (quality-gate) при отсутствии эндпоинта могут давать ошибку; нужна аккуратная обработка | Средний |
| **test-env-groups** | data/test-env-groups/:id.json — при необходимости маппинг на бэкенд, иначе заглушка | Низкий |

---

## Сводка

- **Backend:** Реализованы launches (включая parent/run_key/environments, variables), test results (список, один, history, search), trees (все 4 типа), widgets (summary, status, duration, flaky, retries, **timeline, globals, tree-filters, variables, allure_environment, quality-gate**), attachments, POST /launches/:id/globals, POST /launches/:id/variables, генерация отчётов.
- **Frontend:** Реализованы выбор клиента, маппинг путей для деревьев, виджетов (включая timeline, globals, tree-filters, variables, allure_environment, quality-gate), nav, test-results, attachments; **реальные environments** из GET /launches/:id/environments; секции Results, Charts, Timeline работают с данными API.

---

## Тесты (TDD)

Написаны тесты, которые **падают** до реализации и **проходят** после:

| Тесты | Расположение |
|-------|--------------|
| Backend E2E: timeline, globals, quality-gate, allure_environment, variables, tree-filters | `packages/backend/test/e2e/api-widgets-todo.e2e.spec.ts` |
| Frontend unit: getApiReportUrl для новых путей | `packages/web-commons/test/apiReportClient.test.ts` |
| Playwright E2E: Timeline section, Environment picker | `packages/e2e/test/frontend-backend/report-awesome-todo.spec.ts` |
