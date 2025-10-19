const { PrismaClient } = require('@prisma/client');
const { verifyJwt } = require('../_lib/jwt');

// Создаем новый экземпляр Prisma для каждого запроса
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
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

    console.log('[ME] Token found:', !!token);
    console.log('[ME] Authorization header:', req.headers.authorization);
    console.log('[ME] Cookie header:', req.headers.cookie);

    if (!token) {
      console.log('[ME] No token provided');
      return res.status(401).json({ message: 'Токен не предоставлен' });
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      console.log('[ME] Invalid token');
      return res.status(401).json({ message: 'Недействительный токен' });
    }

    console.log('[ME] Token decoded successfully:', decoded);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Ошибка получения данных пользователя' });
  } finally {
    await prisma.$disconnect();
  }
};
