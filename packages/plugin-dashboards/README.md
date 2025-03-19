# Allure Charts Plugin

Плагин для генерации графиков трендов для отчетов Allure.

## Установка

```bash
npm install @allurereport/plugin-dashboards
```

## Использование

```typescript
import { ChartsPlugin } from "@allurereport/plugin-dashboards";

// Создание экземпляра плагина
const chartsPlugin = new ChartsPlugin({
  // Опции плагина
  singleFile: false
});

// Добавление плагина в конфигурацию Allure
const allure = new AllureReport({
  // ...
  plugins: [
    // ...
    chartsPlugin
  ]
});
```

## Типы графиков

### Тренды статусов

Графики трендов статусов показывают изменение статусов тестов с течением времени.

### Тренды серьезности

Графики трендов серьезности показывают изменение распределения тестов по уровням серьезности с течением времени.

## API

### ChartsPlugin

Основной класс плагина.

#### Опции

- `singleFile` - если `true`, то данные графиков будут сохранены в памяти, а не в файлах.

## Лицензия

Apache-2.0 