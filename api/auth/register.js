const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { signJwt } = require('../_lib/jwt');

// Создаем новый экземпляр Prisma для каждого запроса
const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120)
});

function respondWithUser(res, user) {
  const token = signJwt(user);

  // Для Vercel serverless функций используем заголовки вместо cookies
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${24 * 60 * 60}`);
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    },
    token: token // Также возвращаем токен в ответе для клиента
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: 'EMPLOYEE',
        fullName: data.fullName
      }
    });

    respondWithUser(res, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('Register error:', error);
    res.status(500).json({ message: 'Не удалось создать аккаунт' });
  } finally {
    await prisma.$disconnect();
  }
};
