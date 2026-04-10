import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sankoerp.com' },
    update: {},
    create: {
      email: 'admin@sankoerp.com',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  // Manager user
  const mgr = await prisma.user.upsert({
    where: { email: 'manager@sankoerp.com' },
    update: {},
    create: {
      email: 'manager@sankoerp.com',
      passwordHash: await bcrypt.hash('Manager@123!', 12),
      role: 'MANAGER',
    },
  });

  // Sample client
  const client = await prisma.client.upsert({
    where: { code: 'CLI-0001' },
    update: {},
    create: {
      code: 'CLI-0001',
      name: 'Singtel Infra Solutions',
      contactName: 'John Tan',
      contactEmail: 'john.tan@singtel.com',
      contactPhone: '+65 9123 4567',
      uen: '200012345A',
      gstRegistered: true,
      creditTermDays: 30,
    },
  });

  // Equipment categories
  const safetyCategory = await prisma.equipmentCategory.upsert({
    where: { name: 'Safety Equipment' },
    update: {},
    create: { name: 'Safety Equipment', description: 'PPE and safety gear' },
  });

  const toolsCategory = await prisma.equipmentCategory.upsert({
    where: { name: 'Tools & Equipment' },
    update: {},
    create: { name: 'Tools & Equipment', description: 'Electrical and mechanical tools' },
  });

  // Sample employees
  const emp1 = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-0001' },
    update: {},
    create: {
      employeeCode: 'EMP-0001',
      firstName: 'Ali',
      lastName: 'Hassan',
      nationality: 'Malaysian',
      jobTitle: 'Site Supervisor',
      employmentType: 'FOREIGN_WORKER',
      dailyRate: 140,
      cpfApplicable: false,
      joinDate: new Date('2023-01-15'),
      isActive: true,
    },
  });

  const emp2 = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-0002' },
    update: {},
    create: {
      employeeCode: 'EMP-0002',
      firstName: 'Ramu',
      lastName: 'Kumar',
      nationality: 'Indian',
      jobTitle: 'Cable Technician',
      employmentType: 'FOREIGN_WORKER',
      dailyRate: 95,
      cpfApplicable: false,
      joinDate: new Date('2023-03-01'),
      isActive: true,
    },
  });

  // Work passes
  await prisma.workPass.upsert({
    where: { passNumber: 'WP-SG-2024-001' },
    update: {},
    create: {
      employeeId: emp1.id,
      passType: 'WORK_PERMIT',
      passNumber: 'WP-SG-2024-001',
      issueDate: new Date('2024-01-01'),
      expiryDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
  });

  await prisma.workPass.upsert({
    where: { passNumber: 'WP-SG-2024-002' },
    update: {},
    create: {
      employeeId: emp2.id,
      passType: 'WORK_PERMIT',
      passNumber: 'WP-SG-2024-002',
      issueDate: new Date('2024-03-01'),
      expiryDate: new Date('2026-05-15'), // Expiring soon for demo
      status: 'ACTIVE',
    },
  });

  // Sample equipment items
  await prisma.equipmentItem.upsert({
    where: { itemCode: 'ITM-0001' },
    update: {},
    create: {
      itemCode: 'ITM-0001',
      name: 'Safety Shoes',
      categoryId: safetyCategory.id,
      unit: 'pair',
      unitCost: 85,
      totalQuantity: 20,
      availableQuantity: 14,
      minStockLevel: 5,
      depreciationRate: 0,
    },
  });

  await prisma.equipmentItem.upsert({
    where: { itemCode: 'ITM-0002' },
    update: {},
    create: {
      itemCode: 'ITM-0002',
      name: 'Hard Hat',
      categoryId: safetyCategory.id,
      unit: 'unit',
      unitCost: 25,
      totalQuantity: 30,
      availableQuantity: 22,
      minStockLevel: 10,
      depreciationRate: 0,
    },
  });

  await prisma.equipmentItem.upsert({
    where: { itemCode: 'ITM-0003' },
    update: {},
    create: {
      itemCode: 'ITM-0003',
      name: 'Cable Tester',
      categoryId: toolsCategory.id,
      unit: 'unit',
      unitCost: 350,
      totalQuantity: 5,
      availableQuantity: 3,
      minStockLevel: 2,
      depreciationRate: 0.2,
      usefulLifeDays: 1825,
    },
  });

  // Employee user accounts linked to emp1 and emp2
  await prisma.user.upsert({
    where: { email: 'ali.hassan@sankoerp.com' },
    update: {},
    create: {
      email: 'ali.hassan@sankoerp.com',
      passwordHash: await bcrypt.hash('Employee@123!', 12),
      role: 'EMPLOYEE',
      employee: { connect: { id: emp1.id } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'ramu.kumar@sankoerp.com' },
    update: {},
    create: {
      email: 'ramu.kumar@sankoerp.com',
      passwordHash: await bcrypt.hash('Employee@123!', 12),
      role: 'EMPLOYEE',
      employee: { connect: { id: emp2.id } },
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('🔑 Login credentials:');
  console.log('   Admin:   admin@sankoerp.com / Admin@123!');
  console.log('   Manager: manager@sankoerp.com / Manager@123!');
  console.log('   Employee (Ali):  ali.hassan@sankoerp.com / Employee@123!');
  console.log('   Employee (Ramu): ramu.kumar@sankoerp.com / Employee@123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
