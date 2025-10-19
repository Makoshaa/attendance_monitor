const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const adminEmail = 'admin@mail.ru';
    const adminPassword = 'admin123';
    
    console.log('🔍 Checking for existing admin...');
    
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      console.log('👤 Creating admin user...');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          fullName: 'System Administrator'
        }
      });

      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', adminEmail);
      console.log('🔑 Password:', adminPassword);
      console.log('🆔 User ID:', admin.id);
    } else {
      console.log('ℹ️ Admin user already exists:', adminEmail);
    }
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
