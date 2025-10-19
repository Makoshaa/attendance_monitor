const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const crypto = require('crypto');

const prisma = require('../prismaClient');
const { signJwt } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory хранилище для мобильных токенов (token -> { userId, type, expiresAt, status, attendanceData })
// status: 'pending' | 'completed'
const mobileTokens = new Map();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function respondWithUser(res, user) {
  const token = signJwt(user);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  };

  res.cookie('token', token, cookieOptions);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    }
  });
}

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: 'EMPLOYEE',
        fullName: data.fullName
      }
    });

    respondWithUser(res, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('Register error:', error);
    res.status(500).json({ message: 'Не удалось создать аккаунт' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    respondWithUser(res, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('Login error:', error);
    res.status(500).json({ message: 'Ошибка авторизации' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', authenticate(), (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    }
  });
});

// Генерация мобильного токена для QR-кода
router.post('/mobile-token', authenticate(), (req, res) => {
  try {
    const { type } = req.body;
    const userId = req.user.id;

    // Генерируем случайный токен
    const token = crypto.randomBytes(32).toString('hex');

    // Токен действителен 5 минут
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Сохраняем токен
    mobileTokens.set(token, {
      userId,
      type: type || 'CHECK_IN',
      expiresAt,
      status: 'pending',
      attendanceData: null
    });

    console.log(`[MobileToken] Generated token for user ${userId}: ${token.substring(0, 10)}...`);
    console.log(`[MobileToken] Total tokens in memory: ${mobileTokens.size}`);

    // Очищаем старые токены
    for (const [key, value] of mobileTokens.entries()) {
      if (value.expiresAt < Date.now()) {
        mobileTokens.delete(key);
      }
    }

    res.json({ token, expiresIn: 300 });
  } catch (error) {
    console.error('Mobile token generation error:', error);
    res.status(500).json({ message: 'Не удалось сгенерировать токен' });
  }
});

// Валидация мобильного токена
router.get('/mobile-verify', async (req, res) => {
  try {
    const { token } = req.query;

    console.log(`[MobileVerify] Verifying token: ${token ? token.substring(0, 10) + '...' : 'undefined'}`);
    console.log(`[MobileVerify] Total tokens in memory: ${mobileTokens.size}`);

    if (!token) {
      console.log('[MobileVerify] Error: No token provided');
      return res.status(400).json({ message: 'Токен обязателен' });
    }

    const tokenData = mobileTokens.get(token);

    if (!tokenData) {
      console.log('[MobileVerify] Error: Token not found in memory');
      console.log('[MobileVerify] Available token prefixes:', Array.from(mobileTokens.keys()).map(t => t.substring(0, 10)));
      return res.status(401).json({ message: 'Токен недействителен' });
    }

    console.log(`[MobileVerify] Token found for user: ${tokenData.userId}`);

    if (tokenData.expiresAt < Date.now()) {
      console.log('[MobileVerify] Error: Token expired');
      mobileTokens.delete(token);
      return res.status(401).json({ message: 'Токен истек. Пожалуйста, отсканируйте QR-код заново' });
    }

    // Получаем данные пользователя
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId }
    });

    if (!user) {
      mobileTokens.delete(token);
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Генерируем JWT токен для аутентификации запросов
    const jwtToken = signJwt(user);

    console.log(`[MobileVerify] Success! JWT generated for user: ${user.id}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      },
      token: jwtToken,
      type: tokenData.type
    });
  } catch (error) {
    console.error('[MobileVerify] Error:', error);
    res.status(500).json({ message: 'Ошибка валидации токена' });
  }
});

// Проверка статуса мобильного токена (для polling с десктопа)
router.get('/mobile-token-status', authenticate(), (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Токен обязателен' });
    }

    const tokenData = mobileTokens.get(token);

    if (!tokenData) {
      return res.status(404).json({ message: 'Токен не найден' });
    }

    // Проверяем что токен принадлежит текущему пользователю
    if (tokenData.userId !== req.user.id) {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    res.json({
      status: tokenData.status,
      attendanceData: tokenData.attendanceData
    });
  } catch (error) {
    console.error('[TokenStatus] Error:', error);
    res.status(500).json({ message: 'Ошибка проверки статуса' });
  }
});

// Отметка токена как completed (вызывается с мобильного после успешной отметки)
router.post('/mobile-token-complete', (req, res) => {
  try {
    const { token, attendanceData } = req.body;

    console.log(`[TokenComplete] Marking token as completed: ${token ? token.substring(0, 10) + '...' : 'undefined'}`);

    if (!token) {
      return res.status(400).json({ message: 'Токен обязателен' });
    }

    const tokenData = mobileTokens.get(token);

    if (!tokenData) {
      console.log('[TokenComplete] Token not found');
      return res.status(404).json({ message: 'Токен не найден' });
    }

    // Обновляем статус токена
    tokenData.status = 'completed';
    tokenData.attendanceData = attendanceData;
    mobileTokens.set(token, tokenData);

    console.log(`[TokenComplete] Token marked as completed for user: ${tokenData.userId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[TokenComplete] Error:', error);
    res.status(500).json({ message: 'Ошибка обновления статуса' });
  }
});

module.exports = router;
