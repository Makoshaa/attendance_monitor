const prisma = require('../_lib/prisma');
const { verifyJwt } = require('../_lib/jwt');

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
