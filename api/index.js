// Главный API endpoint для Vercel
module.exports = async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    console.log(`[API] ${req.method} ${pathname}`);
    
    // Маршрутизация API запросов
    if (pathname.startsWith('/api/auth/')) {
      return require('./auth')(req, res);
    }
    
    if (pathname.startsWith('/api/attendance/')) {
      return require('./attendance')(req, res);
    }
    
    if (pathname.startsWith('/api/admin/')) {
      return require('./admin')(req, res);
    }
    
    if (pathname === '/api/health') {
      return require('./health')(req, res);
    }
    
    if (pathname === '/api/test-db') {
      return require('./test-db')(req, res);
    }
    
    console.log(`[API] 404 - Not found: ${pathname}`);
    res.status(404).json({ message: 'API endpoint not found' });
  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
