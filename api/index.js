// Главный API endpoint для Vercel
module.exports = async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Маршрутизация API запросов
  if (pathname.startsWith('/api/auth/')) {
    const authHandler = require('./auth');
    return authHandler(req, res);
  }
  
  if (pathname.startsWith('/api/attendance/')) {
    const attendanceHandler = require('./attendance');
    return attendanceHandler(req, res);
  }
  
  if (pathname.startsWith('/api/admin/')) {
    const adminHandler = require('./admin');
    return adminHandler(req, res);
  }
  
  if (pathname === '/api/health') {
    return require('./health')(req, res);
  }
  
  res.status(404).json({ message: 'API endpoint not found' });
};
