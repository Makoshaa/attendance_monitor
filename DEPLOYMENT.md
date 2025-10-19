# Инструкции по деплою в Vercel

## Настройка переменных окружения в Vercel

1. Перейдите в настройки проекта в Vercel Dashboard
2. Добавьте следующие переменные окружения:

```
DATABASE_URL=postgresql://neondb_owner:npg_qy8Im9zELefb@ep-steep-tooth-adus7o5d-pooler.c-2.us-east-1.aws.neon.tech/attendance_project_db?sslmode=require&channel_binding=require
JWT_SECRET=your-jwt-secret-key-here
CLIENT_ORIGIN=https://your-app.vercel.app
NODE_ENV=production
FACE_DISTANCE_THRESHOLD=0.6
MIN_LIVENESS_THRESHOLD=0.9
```

## Шаги деплоя

1. **Подключите репозиторий к Vercel:**
   - Войдите в Vercel Dashboard
   - Нажмите "New Project"
   - Подключите ваш GitHub репозиторий

2. **Настройте переменные окружения:**
   - В настройках проекта добавьте все переменные из списка выше
   - Замените `your-jwt-secret-key-here` на случайную строку
   - Замените `https://your-app.vercel.app` на ваш реальный URL

3. **Деплой:**
   - Vercel автоматически запустит сборку
   - Проект будет доступен по URL, который предоставит Vercel

## Структура API endpoints

После деплоя будут доступны следующие API endpoints:

- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Вход в систему
- `GET /api/auth/me` - Получение данных текущего пользователя
- `POST /api/attendance/mark` - Отметка посещения
- `GET /api/attendance/history` - История посещений
- `GET /api/admin/users` - Список пользователей (только для админов)
- `GET /api/health` - Проверка состояния API

## Важные замечания

1. **База данных:** Убедитесь, что ваша Neon база данных доступна и миграции применены
2. **CORS:** Настройте CLIENT_ORIGIN для вашего домена
3. **JWT Secret:** Используйте надежный секретный ключ для JWT
4. **Модели:** Убедитесь, что папка `models` с ML моделями загружена в проект

## Проверка деплоя

После деплоя проверьте:
1. `GET /api/health` - должен вернуть `{"status": "ok"}`
2. Попробуйте зарегистрировать пользователя через `POST /api/auth/register`
3. Проверьте подключение к базе данных через любой API endpoint
