const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../_lib/prisma');
const { verifyJwt } = require('../_lib/jwt');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120)
});

// Функция для проверки токена
async function verifyAdminToken(req) {
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

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub }
  });

  if (!user || user.role !== 'ADMIN') {
    throw new Error('Доступ запрещен');
  }

  return user;
}

module.exports = async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    console.log(`[ADMIN] ${req.method} ${pathname}`);
    
    // Проверяем права администратора для всех операций
    const admin = await verifyAdminToken(req);
    console.log('[ADMIN] Admin verified:', admin.email);
    
    // GET /api/admin/users - получить список сотрудников
    if (pathname === '/api/admin/users' && req.method === 'GET') {
      const employees = await prisma.user.findMany({
        where: { role: 'EMPLOYEE' },
        include: {
          descriptors: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.json({
        users: employees.map((user) => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          descriptorCount: user.descriptors.length,
          createdAt: user.createdAt
        }))
      });
    }
    
    // POST /api/admin/users - создать нового сотрудника
    if (pathname === '/api/admin/users' && req.method === 'POST') {
      const data = createUserSchema.parse(req.body);

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

      console.log('[ADMIN] User created successfully:', user.email);

      return res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          createdAt: user.createdAt
        }
      });
    }
    
    // Если endpoint не найден
    return res.status(404).json({ message: 'Admin endpoint not found' });
    
  } catch (error) {
    if (error.message === 'Токен не предоставлен' || 
        error.message === 'Недействительный токен' || 
        error.message === 'Доступ запрещен') {
      return res.status(401).json({ message: error.message });
    }
    
    if (error instanceof z.ZodError) {
      console.log('[ADMIN] Validation error:', error.issues);
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('[ADMIN] Error:', error);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};
