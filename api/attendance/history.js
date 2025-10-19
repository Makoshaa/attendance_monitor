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

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const userId = user.role === 'ADMIN' && req.query.userId ? req.query.userId : user.id;

    const records = await prisma.attendance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      records: records.map((record) => ({
        id: record.id,
        type: record.type,
        confidence: record.confidence,
        livenessScore: record.livenessScore,
        createdAt: record.createdAt
      }))
    });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ message: 'Не удалось получить историю отметок' });
  }
};
