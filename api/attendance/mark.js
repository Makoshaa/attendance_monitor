const { z } = require('zod');
const prisma = require('../_lib/prisma');
const { verifyJwt } = require('../_lib/jwt');
const { findBestMatch } = require('../../server/services/faceService');

const markSchema = z.object({
  descriptor: z.array(z.number()).min(1),
  livenessScore: z.number().min(0).max(1),
  type: z.enum(['CHECK_IN', 'CHECK_OUT']).optional().default('CHECK_IN')
});

const FACE_DISTANCE_THRESHOLD = Number(process.env.FACE_DISTANCE_THRESHOLD || 0.6);
const MIN_LIVENESS_THRESHOLD = Number(process.env.MIN_LIVENESS_THRESHOLD || 0.9);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

    if (!user || user.role !== 'EMPLOYEE') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const data = markSchema.parse(req.body);

    if (data.livenessScore < MIN_LIVENESS_THRESHOLD) {
      return res.status(400).json({ message: 'Проверка подлинности лица не пройдена' });
    }

    const descriptors = await prisma.faceDescriptor.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (descriptors.length === 0) {
      return res.status(409).json({ message: 'Для сотрудника отсутствуют эталонные снимки' });
    }

    const bestMatch = findBestMatch(descriptors.map((item) => item.descriptor), data.descriptor);

    if (!bestMatch || bestMatch.distance > FACE_DISTANCE_THRESHOLD) {
      return res.status(403).json({ message: 'Лицо не распознано' });
    }

    const confidence = Math.max(0, 1 - bestMatch.distance);

    const attendance = await prisma.attendance.create({
      data: {
        userId: user.id,
        type: data.type || 'CHECK_IN',
        confidence,
        livenessScore: data.livenessScore
      }
    });

    res.json({
      success: true,
      type: attendance.type,
      confidence,
      livenessScore: attendance.livenessScore,
      recordedAt: attendance.createdAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('Attendance mark error:', error);
    res.status(500).json({ message: 'Не удалось сохранить отметку' });
  }
};
