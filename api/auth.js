const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { signJwt, verifyJwt } = require('./_lib/jwt');

// Создаем новый экземпляр Prisma для каждого запроса
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120)
});

function respondWithUser(res, user) {
  const token = signJwt(user);

  // Для Vercel serverless функций используем заголовки вместо cookies
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${24 * 60 * 60}`);
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    },
    token: token // Также возвращаем токен в ответе для клиента
  });
}

// Функция для проверки токена
async function verifyToken(req) {
  let token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    token = cookies.token;
  }

  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    throw new Error('Недействительный токен');
  }

  return decoded;
}

module.exports = async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    console.log(`[AUTH] ${req.method} ${pathname}`);
    
    // POST /api/auth/login - вход
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      console.log('[LOGIN] Attempting login for:', req.body.email);
      
      const data = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email: data.email } });

      if (!user) {
        console.log('[LOGIN] User not found:', data.email);
        return res.status(401).json({ message: 'Неверные учетные данные' });
      }

      console.log('[LOGIN] User found:', user.email, 'Role:', user.role);

      const valid = await bcrypt.compare(data.password, user.passwordHash);

      if (!valid) {
        console.log('[LOGIN] Invalid password for:', data.email);
        return res.status(401).json({ message: 'Неверные учетные данные' });
      }

      console.log('[LOGIN] Successful login for:', data.email);
      return respondWithUser(res, user);
    }
    
    // POST /api/auth/register - регистрация
    if (pathname === '/api/auth/register' && req.method === 'POST') {
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

      return respondWithUser(res, user);
    }
    
    // GET /api/auth/me - получить текущего пользователя
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const decoded = await verifyToken(req);
      console.log('[ME] Token decoded successfully:', decoded);

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub }
      });

      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName
        }
      });
    }
    
    // Если endpoint не найден
    return res.status(404).json({ message: 'Auth endpoint not found' });
    
  } catch (error) {
    if (error.message === 'Токен не предоставлен' || 
        error.message === 'Недействительный токен') {
      return res.status(401).json({ message: error.message });
    }
    
    if (error instanceof z.ZodError) {
      console.log('[AUTH] Validation error:', error.issues);
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('[AUTH] Error:', error);
    return res.status(500).json({ message: 'Ошибка авторизации' });
  } finally {
    await prisma.$disconnect();
  }
};
