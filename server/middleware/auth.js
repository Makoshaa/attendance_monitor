const prisma = require('../prismaClient');
const { verifyJwt } = require('../utils/jwt');

function authenticate(roles = []) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;
    const token = req.cookies?.token || bearerToken;

    if (!token) {
      return res.status(401).json({ message: 'Необходима авторизация' });
    }

    try {
      const payload = verifyJwt(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });

      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'Доступ запрещён' });
      }

      if (roles.length > 0 && !roles.includes(user.role)) {
        return res.status(403).json({ message: 'Недостаточно прав' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Неверный или истёкший токен' });
    }
  };
}

module.exports = {
  authenticate
};
