import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const ADMIN_EMAIL = 'admin@madis.com';
const ADMIN_PASSWORD = 'Password123!';
const ADMIN_USERNAME = 'admin';
const PASSWORD_SALT_ROUNDS = 12;

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the seed.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
  });

  try {
    const sellerRole = await prisma.role.upsert({
      where: { label: 'SELLER' },
      update: {
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'SELLER',
      },
    });

    const adminRole = await prisma.role.upsert({
      where: { label: 'ADMIN' },
      update: {
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'ADMIN',
      },
    });

    const canSellPermission = await prisma.permission.upsert({
      where: { code: 'CAN_SELL' },
      update: {
        label: 'Can sell',
        descriptions: 'Allows access to selling features.',
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'Can sell',
        code: 'CAN_SELL',
        descriptions: 'Allows access to selling features.',
      },
    });

    const allPermission = await prisma.permission.upsert({
      where: { code: 'ALL' },
      update: {
        label: 'All permissions',
        descriptions: 'Allows access to all application features.',
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'All permissions',
        code: 'ALL',
        descriptions: 'Allows access to all application features.',
      },
    });

    await prisma.permission.upsert({
      where: { code: 'CAN_SUPPLIERS' },
      update: {
        label: 'Can manage suppliers',
        descriptions: 'Allows access to supplier management features.',
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'Can manage suppliers',
        code: 'CAN_SUPPLIERS',
        descriptions: 'Allows access to supplier management features.',
      },
    });

    await prisma.permission.upsert({
      where: { code: 'CAN_PRODUCTS' },
      update: {
        label: 'Can manage products',
        descriptions: 'Allows access to product management features.',
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'Can manage products',
        code: 'CAN_PRODUCTS',
        descriptions: 'Allows access to product management features.',
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: sellerRole.id,
          permissionId: canSellPermission.id,
        },
      },
      update: {
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        roleId: sellerRole.id,
        permissionId: canSellPermission.id,
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: allPermission.id,
        },
      },
      update: {
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        roleId: adminRole.id,
        permissionId: allPermission.id,
      },
    });

    const hashedPassword = await hash(ADMIN_PASSWORD, PASSWORD_SALT_ROUNDS);
    const adminUser = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        password: hashedPassword,
        userName: ADMIN_USERNAME,
        roleId: adminRole.id,
        deletedAt: null,
      },
      create: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        userName: ADMIN_USERNAME,
        roleId: adminRole.id,
      },
    });

    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId: adminUser.id,
          permissionId: allPermission.id,
        },
      },
      update: {
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        userId: adminUser.id,
        permissionId: allPermission.id,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
