const { PrismaClient } = require('@prisma/client');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const prisma = new PrismaClient();

  try {
    console.log('[TEST-DB] Testing database connection...');
    
    // Проверяем подключение к базе данных
    await prisma.$connect();
    console.log('[TEST-DB] Database connected successfully');
    
    // Проверяем количество пользователей
    const userCount = await prisma.user.count();
    console.log('[TEST-DB] User count:', userCount);
    
    // Проверяем, есть ли админ
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    res.json({
      status: 'success',
      databaseConnected: true,
      userCount,
      adminExists: !!admin,
      adminEmail: admin?.email || null
    });
  } catch (error) {
    console.error('[TEST-DB] Error:', error);
    res.status(500).json({
      status: 'error',
      databaseConnected: false,
      error: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
};
