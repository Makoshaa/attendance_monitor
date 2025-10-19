const { PrismaClient } = require('@prisma/client');
const { verifyJwt } = require('../_lib/jwt');

// Создаем новый экземпляр Prisma для каждого запроса
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Токен не предоставлен' });
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Недействительный токен' });
    }

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
