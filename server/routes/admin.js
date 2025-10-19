const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { distanceBetween } = require('../services/faceService');

const router = express.Router();

const createEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120),
  descriptor: z.array(z.number()).min(1)
});

router.use(authenticate(['ADMIN']));

router.get('/users', async (_req, res) => {
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    include: {
      descriptors: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json({
    users: employees.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      descriptorCount: user.descriptors.length,
      createdAt: user.createdAt
    }))
  });
});

router.post('/users', async (req, res) => {
  try {
    const data = createEmployeeSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      return res.status(409).json({ message: 'Сотрудник с таким email уже существует' });
    }

    // Получить все дескрипторы из БД для проверки на дубликаты
    const allDescriptors = await prisma.faceDescriptor.findMany({
      select: {
        descriptor: true,
        userId: true
      }
    });

    // Проверить расстояние до каждого существующего дескриптора
    const THRESHOLD = 0.6;
    for (const storedDescriptor of allDescriptors) {
      const distance = distanceBetween(data.descriptor, storedDescriptor.descriptor);
      if (distance < THRESHOLD) {
        return res.status(409).json({ message: 'Это фото лица уже привязано к другому сотруднику' });
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'EMPLOYEE',
          fullName: data.fullName
        }
      });

      await tx.faceDescriptor.create({
        data: {
          userId: createdUser.id,
          descriptor: data.descriptor
        }
      });

      return createdUser;
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        descriptorCount: 1
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }

    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Не удалось создать сотрудника' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || user.role !== 'EMPLOYEE') {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    await prisma.faceDescriptor.deleteMany({ where: { userId: id } });
    await prisma.attendance.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Не удалось удалить сотрудника' });
  }
});

router.post('/users/:id/photo', async (req, res) => {
  const { id } = req.params;
  const { descriptor } = req.body;

  if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
    return res.status(400).json({ message: 'Дескриптор обязателен и должен быть массивом чисел' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || user.role !== 'EMPLOYEE') {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    // Получить все дескрипторы из БД (кроме текущего пользователя)
    const allDescriptors = await prisma.faceDescriptor.findMany({
      where: {
        NOT: {
          userId: id
        }
      },
      select: {
        descriptor: true,
        userId: true
      }
    });

    // Проверить расстояние до каждого существующего дескриптора
    const THRESHOLD = 0.6;
    for (const storedDescriptor of allDescriptors) {
      const distance = distanceBetween(descriptor, storedDescriptor.descriptor);
      if (distance < THRESHOLD) {
        return res.status(409).json({ message: 'Это фото лица уже привязано к другому сотруднику' });
      }
    }

    const existingDescriptor = await prisma.faceDescriptor.findFirst({
      where: { userId: id }
    });

    const record = existingDescriptor
      ? await prisma.faceDescriptor.update({
          where: { id: existingDescriptor.id },
          data: { descriptor }
        })
      : await prisma.faceDescriptor.create({
          data: {
            userId: id,
            descriptor
          }
        });

    res.json({
      descriptorId: record.id,
      descriptorCount: 1,
      replaced: Boolean(existingDescriptor)
    });
  } catch (error) {
    console.error('Upload descriptor error:', error);
    res.status(500).json({ message: 'Не удалось сохранить дескриптор' });
  }
});

router.get('/attendance/all', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const date = req.query.date;

    const where = {};
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      where.createdAt = {
        gte: startOfDay,
        lt: endOfDay
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    res.json({
      attendances: attendances.map(record => ({
        id: record.id,
        userId: record.userId,
        userName: record.user.fullName || record.user.email,
        userEmail: record.user.email,
        type: record.type,
        confidence: record.confidence,
        livenessScore: record.livenessScore,
        createdAt: record.createdAt
      }))
    });
  } catch (error) {
    console.error('Get all attendances error:', error);
    res.status(500).json({ message: 'Не удалось получить отметки' });
  }
});

module.exports = router;
