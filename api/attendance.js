const { z } = require('zod');
const prisma = require('./_lib/prisma');
const { verifyJwt } = require('./_lib/jwt');

const markSchema = z.object({
  descriptor: z.array(z.number()).min(1),
  livenessScore: z.number().min(0).max(1),
  type: z.enum(['CHECK_IN', 'CHECK_OUT']).optional().default('CHECK_IN')
});

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
    
    console.log(`[ATTENDANCE] ${req.method} ${pathname}`);
    
    // POST /api/attendance/mark - отметить посещение
    if (pathname === '/api/attendance/mark' && req.method === 'POST') {
      const decoded = await verifyToken(req);
      console.log('[ATTENDANCE] Token verified for user:', decoded.sub);

      const data = markSchema.parse(req.body);

      // Здесь должна быть логика распознавания лица
      // Пока что создаем запись напрямую
      const attendance = await prisma.attendance.create({
        data: {
          userId: decoded.sub,
          type: data.type,
          livenessScore: data.livenessScore,
          faceDescriptor: data.descriptor
        }
      });

      console.log('[ATTENDANCE] Attendance marked:', attendance.id);

      return res.json({
        attendance: {
          id: attendance.id,
          type: attendance.type,
          timestamp: attendance.timestamp,
          livenessScore: attendance.livenessScore
        }
      });
    }
    
    // GET /api/attendance/history - получить историю посещений
    if (pathname === '/api/attendance/history' && req.method === 'GET') {
      const decoded = await verifyToken(req);
      console.log('[ATTENDANCE] Getting history for user:', decoded.sub);

      const attendances = await prisma.attendance.findMany({
        where: { userId: decoded.sub },
        orderBy: { timestamp: 'desc' },
        take: 50
      });

      return res.json({
        attendances: attendances.map(attendance => ({
          id: attendance.id,
          type: attendance.type,
          timestamp: attendance.timestamp,
          livenessScore: attendance.livenessScore
        }))
      });
    }
    
    // Если endpoint не найден
    return res.status(404).json({ message: 'Attendance endpoint not found' });
    
  } catch (error) {
    if (error.message === 'Токен не предоставлен' || 
        error.message === 'Недействительный токен') {
      return res.status(401).json({ message: error.message });
    }
    
    if (error instanceof z.ZodError) {
      console.log('[ATTENDANCE] Validation error:', error.issues);
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('[ATTENDANCE] Error:', error);
    return res.status(500).json({ message: 'Ошибка при работе с посещениями' });
  }
};
