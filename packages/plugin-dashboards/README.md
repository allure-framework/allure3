# Allure Dashboards Plugin

Плагин для генерации дашбордов с графиками трендов для отчетов Allure.

## Установка

```bash
npm install @allurereport/plugin-dashboards
```

## Использование

```typescript
import { DashboardsPlugin } from "@allurereport/plugin-dashboards";

// Создание экземпляра плагина
const dashboardsPlugin = new DashboardsPlugin({
  // Опции плагина
  singleFile: false
});

// Добавление плагина в конфигурацию Allure
const allure = new AllureReport({
  // ...
  plugins: [
    // ...
    dashboardsPlugin
  ]
});
```

## Типы графиков

### Тренды статусов

Графики трендов статусов показывают изменение статусов тестов с течением времени.

### Тренды серьезности

Графики трендов серьезности показывают изменение распределения тестов по уровням серьезности с течением времени.

## API

### DashboardsPlugin

Основной класс плагина.

#### Опции

- `singleFile` - если `true`, то данные дашборда будут сохранены в памяти, а не в файлах.

## Лицензия

Apache-2.0 