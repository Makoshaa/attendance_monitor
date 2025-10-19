const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../_lib/prisma');
const { verifyJwt } = require('../_lib/jwt');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120)
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Проверяем токен из разных источников
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    // Если нет в Authorization header, проверяем cookies
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    console.log('[CREATE_USER] Token found:', !!token);
    console.log('[CREATE_USER] Authorization header:', req.headers.authorization);
    console.log('[CREATE_USER] Cookie header:', req.headers.cookie);

    if (!token) {
      console.log('[CREATE_USER] No token provided');
      return res.status(401).json({ message: 'Токен не предоставлен' });
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      console.log('[CREATE_USER] Invalid token');
      return res.status(401).json({ message: 'Недействительный токен' });
    }

    console.log('[CREATE_USER] Token decoded successfully:', decoded);

    const admin = await prisma.user.findUnique({
      where: { id: decoded.sub }
    });

    if (!admin || admin.role !== 'ADMIN') {
      console.log('[CREATE_USER] Access denied for user:', admin?.role);
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

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

    console.log('[CREATE_USER] User created successfully:', user.email);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('[CREATE_USER] Validation error:', error.issues);
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('[CREATE_USER] Error:', error);
    res.status(500).json({ message: 'Не удалось создать пользователя' });
  }
};
