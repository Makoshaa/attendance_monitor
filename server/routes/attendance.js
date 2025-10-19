const express = require('express');
const { z } = require('zod');

const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { findBestMatch } = require('../services/faceService');

const router = express.Router();

const markSchema = z.object({
  descriptor: z.array(z.number()).min(1),
  livenessScore: z.number().min(0).max(1),
  type: z.enum(['CHECK_IN', 'CHECK_OUT']).optional().default('CHECK_IN')
});

const FACE_DISTANCE_THRESHOLD = Number(process.env.FACE_DISTANCE_THRESHOLD || 0.6);
const MIN_LIVENESS_THRESHOLD = Number(process.env.MIN_LIVENESS_THRESHOLD || 0.9);

router.post('/mark', authenticate(['EMPLOYEE']), async (req, res) => {
  try {
    const data = markSchema.parse(req.body);

    if (data.livenessScore < MIN_LIVENESS_THRESHOLD) {
      return res.status(400).json({ message: 'Проверка подлинности лица не пройдена' });
    }

    const descriptors = await prisma.faceDescriptor.findMany({
      where: { userId: req.user.id },
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
        userId: req.user.id,
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
});

router.get('/history', authenticate(['EMPLOYEE', 'ADMIN']), async (req, res) => {
  const userId = req.user.role === 'ADMIN' && req.query.userId ? req.query.userId : req.user.id;

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
});

router.get('/stats', authenticate(['EMPLOYEE', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.role === 'ADMIN' && req.query.userId ? req.query.userId : req.user.id;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);

    const [todayCount, weekCount, monthCount, avgLiveness, recentAttendances] = await Promise.all([
      prisma.attendance.count({
        where: {
          userId,
          createdAt: { gte: todayStart }
        }
      }),
      prisma.attendance.count({
        where: {
          userId,
          createdAt: { gte: weekStart }
        }
      }),
      prisma.attendance.count({
        where: {
          userId,
          createdAt: { gte: monthStart }
        }
      }),
      prisma.attendance.aggregate({
        where: { userId },
        _avg: { livenessScore: true }
      }),
      prisma.attendance.findMany({
        where: {
          userId,
          createdAt: { gte: monthStart }
        },
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          livenessScore: true
        }
      })
    ]);

    const dailyStats = {};
    recentAttendances.forEach(record => {
      const dateKey = new Date(record.createdAt).toLocaleDateString('ru-RU');
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { count: 0, totalLiveness: 0 };
      }
      dailyStats[dateKey].count += 1;
      dailyStats[dateKey].totalLiveness += record.livenessScore;
    });

    const chartData = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      count: stats.count,
      avgConfidence: stats.totalLiveness / stats.count
    }));

    res.json({
      todayCount,
      weekCount,
      monthCount,
      avgConfidence: avgLiveness._avg.livenessScore || 0,
      chartData
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Не удалось получить статистику' });
  }
});

module.exports = router;
