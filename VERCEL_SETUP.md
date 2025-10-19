# Настройка проекта для деплоя в Vercel

## Что было настроено:

### 1. API Routes для Vercel
Созданы отдельные API endpoints в папке `api/`:
- `api/auth/register.js` - Регистрация пользователя
- `api/auth/login.js` - Вход в систему  
- `api/auth/me.js` - Получение данных пользователя
- `api/attendance/mark.js` - Отметка посещения
- `api/attendance/history.js` - История посещений
- `api/admin/users.js` - Список пользователей (админ)
- `api/health.js` - Проверка состояния API

### 2. Конфигурация Vercel
- Обновлен `vercel.json` с настройками для Node.js функций
- Добавлен `vercel-build` скрипт в `package.json`
- Настроен `postinstall` для генерации Prisma клиента

### 3. База данных
- Настроена строка подключения к Neon PostgreSQL
- Добавлены миграции Prisma
- Создан seed файл для создания админа по умолчанию

### 4. Переменные окружения
Создан файл `env.example` с необходимыми переменными:
```
DATABASE_URL=postgresql://neondb_owner:npg_qy8Im9zELefb@ep-steep-tooth-adus7o5d-pooler.c-2.us-east-1.aws.neon.tech/attendance_project_db?sslmode=require&channel_binding=require
JWT_SECRET=your-jwt-secret-key-here
CLIENT_ORIGIN=https://your-app.vercel.app
NODE_ENV=production
```

## Шаги для деплоя:

### 1. Подготовка репозитория
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

### 2. Настройка в Vercel Dashboard
1. Войдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Нажмите "New Project"
3. Подключите ваш GitHub репозиторий
4. В настройках проекта добавьте переменные окружения из `env.example`

### 3. Настройка переменных окружения
В Vercel Dashboard → Settings → Environment Variables добавьте:
- `DATABASE_URL` - ваша строка подключения к Neon
- `JWT_SECRET` - случайная строка для JWT
- `CLIENT_ORIGIN` - URL вашего приложения (будет предоставлен Vercel)
- `NODE_ENV` - `production`

### 4. Деплой
Vercel автоматически запустит сборку. Проект будет доступен по URL, который предоставит Vercel.

## Проверка деплоя:

1. **Проверка API:**
   ```
   GET https://your-app.vercel.app/api/health
   ```
   Должен вернуть: `{"status": "ok"}`

2. **Проверка базы данных:**
   ```
   POST https://your-app.vercel.app/api/auth/register
   ```
   С телом запроса:
   ```json
   {
     "email": "test@example.com",
     "password": "password123",
     "fullName": "Test User"
   }
   ```

## Важные замечания:

1. **ML модели:** Убедитесь, что папка `models` с ML моделями загружена в репозиторий
2. **CORS:** После деплоя обновите `CLIENT_ORIGIN` на реальный URL приложения
3. **JWT Secret:** Используйте надежный секретный ключ для production
4. **База данных:** Убедитесь, что миграции Prisma применены к вашей Neon базе данных

## Структура проекта после настройки:

```
├── api/                    # API routes для Vercel
│   ├── auth/              # Аутентификация
│   ├── attendance/        # Отметки посещения
│   ├── admin/             # Админ функции
│   ├── _lib/              # Общие библиотеки
│   └── _middleware.js     # CORS middleware
├── dist/                  # Собранное приложение
├── models/                # ML модели
├── prisma/                # Схема и миграции БД
├── server/                # Серверный код (для локальной разработки)
├── src/                   # Исходный код React приложения
├── vercel.json            # Конфигурация Vercel
└── package.json           # Зависимости и скрипты
```
