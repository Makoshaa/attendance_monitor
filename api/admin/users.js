const prisma = require('../_lib/prisma');
const { verifyJwt } = require('../_lib/jwt');

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

    console.log('[AUTH] Token found:', !!token);
    console.log('[AUTH] Authorization header:', req.headers.authorization);
    console.log('[AUTH] Cookie header:', req.headers.cookie);

    if (!token) {
      console.log('[AUTH] No token provided');
      return res.status(401).json({ message: 'Токен не предоставлен' });
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      console.log('[AUTH] Invalid token');
      return res.status(401).json({ message: 'Недействительный токен' });
    }

    console.log('[AUTH] Token decoded successfully:', decoded);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      include: {
        descriptors: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      users: employees.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        descriptorCount: user.descriptors.length,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Не удалось получить список пользователей' });
  }
};
