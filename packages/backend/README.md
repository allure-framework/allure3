# Allure 3 Backend

Backend API для Allure 3 с DDD архитектурой.

## Установка

```bash
yarn install
```

## Настройка

1. Скопировать `.env.example` в `.env`
2. Настроить переменные окружения
3. Запустить PostgreSQL: `yarn db:setup`
4. Запустить миграции: `yarn migration:run`

## Разработка

```bash
# Запуск в режиме разработки
yarn dev

# Сборка
yarn build

# Запуск production
yarn start
```

## Тестирование

```bash
# Запуск тестов
yarn test

# Запуск тестов с покрытием
yarn test:coverage

# Запуск тестов в watch режиме
yarn test:watch
```

## Структура проекта

- `src/domain` - Доменный слой
- `src/application` - Слой приложения
- `src/infrastructure` - Инфраструктурный слой
- `src/presentation` - Слой представления (API)
