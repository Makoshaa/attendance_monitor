const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../_lib/prisma');
const { signJwt } = require('../../server/utils/jwt');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function respondWithUser(res, user) {
  const token = signJwt(user);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  };

  res.cookie('token', token, cookieOptions);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    }
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('[LOGIN] Attempting login for:', req.body.email);
    
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      console.log('[LOGIN] User not found:', data.email);
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    console.log('[LOGIN] User found:', user.email, 'Role:', user.role);

    const valid = await bcrypt.compare(data.password, user.passwordHash);

    if (!valid) {
      console.log('[LOGIN] Invalid password for:', data.email);
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    console.log('[LOGIN] Successful login for:', data.email);
    respondWithUser(res, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('[LOGIN] Validation error:', error.issues);
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('[LOGIN] Error:', error);
    res.status(500).json({ message: 'Ошибка авторизации' });
  }
};
