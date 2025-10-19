const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Создаем админа по умолчанию
  const adminEmail = 'admin@mail.ru';
  const adminPassword = 'admin123';
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        fullName: 'System Administrator'
      }
    });

    console.log('✅ Admin user created:', adminEmail);
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
  } else {
    console.log('ℹ️ Admin user already exists:', adminEmail);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });