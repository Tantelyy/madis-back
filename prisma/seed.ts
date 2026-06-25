import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const ADMIN_EMAIL = 'admin@madis.com';
const ADMIN_PASSWORD = 'Password123!';
const ADMIN_USERNAME = 'admin';
const PASSWORD_SALT_ROUNDS = 12;
const PRICING_GRID_EFFECTIVE_FROM = new Date('2026-06-25T00:00:00.000Z');
const PRICING_RULE_STEP = 3_000;
const PRICING_RULE_LAST_MIN_PURCHASE_PRICE = 999_000;

type PricingRateSegment = Readonly<{
  minPurchasePrice: number;
  retailMarginPercent: string;
  wholesaleMarginPercent: string;
}>;

const PRICING_RATE_SEGMENTS: readonly PricingRateSegment[] = [
  {
    minPurchasePrice: 0,
    retailMarginPercent: '28.5',
    wholesaleMarginPercent: '18',
  },
  {
    minPurchasePrice: 3_000,
    retailMarginPercent: '22.5',
    wholesaleMarginPercent: '13',
  },
  {
    minPurchasePrice: 6_000,
    retailMarginPercent: '24',
    wholesaleMarginPercent: '14.5',
  },
  {
    minPurchasePrice: 9_000,
    retailMarginPercent: '23',
    wholesaleMarginPercent: '12',
  },
  {
    minPurchasePrice: 12_000,
    retailMarginPercent: '22',
    wholesaleMarginPercent: '10',
  },
  {
    minPurchasePrice: 15_000,
    retailMarginPercent: '21',
    wholesaleMarginPercent: '9',
  },
  {
    minPurchasePrice: 18_000,
    retailMarginPercent: '19',
    wholesaleMarginPercent: '9',
  },
  {
    minPurchasePrice: 21_000,
    retailMarginPercent: '17',
    wholesaleMarginPercent: '8.5',
  },
  {
    minPurchasePrice: 24_000,
    retailMarginPercent: '15',
    wholesaleMarginPercent: '8.3',
  },
  {
    minPurchasePrice: 27_000,
    retailMarginPercent: '13.5',
    wholesaleMarginPercent: '8.2',
  },
  {
    minPurchasePrice: 30_000,
    retailMarginPercent: '12.5',
    wholesaleMarginPercent: '7.6',
  },
  {
    minPurchasePrice: 33_000,
    retailMarginPercent: '12.5',
    wholesaleMarginPercent: '7',
  },
  {
    minPurchasePrice: 36_000,
    retailMarginPercent: '12.5',
    wholesaleMarginPercent: '6.9',
  },
  {
    minPurchasePrice: 39_000,
    retailMarginPercent: '11',
    wholesaleMarginPercent: '6.9',
  },
  {
    minPurchasePrice: 42_000,
    retailMarginPercent: '10.5',
    wholesaleMarginPercent: '6.9',
  },
  {
    minPurchasePrice: 45_000,
    retailMarginPercent: '10',
    wholesaleMarginPercent: '6.8',
  },
  {
    minPurchasePrice: 48_000,
    retailMarginPercent: '9.5',
    wholesaleMarginPercent: '6.6',
  },
  {
    minPurchasePrice: 51_000,
    retailMarginPercent: '9',
    wholesaleMarginPercent: '6.4',
  },
  {
    minPurchasePrice: 54_000,
    retailMarginPercent: '8.6',
    wholesaleMarginPercent: '6.2',
  },
  {
    minPurchasePrice: 57_000,
    retailMarginPercent: '8.5',
    wholesaleMarginPercent: '6',
  },
  {
    minPurchasePrice: 60_000,
    retailMarginPercent: '8.4',
    wholesaleMarginPercent: '5.8',
  },
  {
    minPurchasePrice: 63_000,
    retailMarginPercent: '8.2',
    wholesaleMarginPercent: '5.7',
  },
  {
    minPurchasePrice: 66_000,
    retailMarginPercent: '8',
    wholesaleMarginPercent: '5.7',
  },
  {
    minPurchasePrice: 69_000,
    retailMarginPercent: '8.5',
    wholesaleMarginPercent: '6',
  },
  {
    minPurchasePrice: 78_000,
    retailMarginPercent: '8.4',
    wholesaleMarginPercent: '6',
  },
  {
    minPurchasePrice: 81_000,
    retailMarginPercent: '7.9',
    wholesaleMarginPercent: '6.5',
  },
  {
    minPurchasePrice: 90_000,
    retailMarginPercent: '7.9',
    wholesaleMarginPercent: '6.6',
  },
  {
    minPurchasePrice: 99_000,
    retailMarginPercent: '7.9',
    wholesaleMarginPercent: '6.8',
  },
];

function findPricingRateSegment(minPurchasePrice: number): PricingRateSegment {
  for (let index = PRICING_RATE_SEGMENTS.length - 1; index >= 0; index -= 1) {
    const segment = PRICING_RATE_SEGMENTS[index];

    if (minPurchasePrice >= segment.minPurchasePrice) {
      return segment;
    }
  }

  return PRICING_RATE_SEGMENTS[0];
}

function toTwoDecimalString(value: number): string {
  return value.toFixed(2);
}

function calculateAverageMargin(
  minPurchasePrice: number,
  maxPurchasePrice: number,
  marginPercent: string,
): string {
  const basePrice =
    minPurchasePrice === 0
      ? maxPurchasePrice
      : (minPurchasePrice + maxPurchasePrice) / 2;
  const marginAmount = (basePrice * Number(marginPercent)) / 100;

  return toTwoDecimalString(marginAmount);
}

function buildPricingRuleInputs(
  pricingGridId: number,
): Prisma.PricingRuleCreateManyInput[] {
  const pricingRules: Prisma.PricingRuleCreateManyInput[] = [];

  for (
    let minPurchasePrice = 0;
    minPurchasePrice <= PRICING_RULE_LAST_MIN_PURCHASE_PRICE;
    minPurchasePrice += PRICING_RULE_STEP
  ) {
    const maxPurchasePrice = minPurchasePrice + PRICING_RULE_STEP - 1;
    const pricingRate = findPricingRateSegment(minPurchasePrice);

    pricingRules.push({
      pricingGridId,
      minPurchasePrice,
      maxPurchasePrice,
      retailMarginPercent: pricingRate.retailMarginPercent,
      wholesaleMarginPercent: pricingRate.wholesaleMarginPercent,
      retailAverage: calculateAverageMargin(
        minPurchasePrice,
        maxPurchasePrice,
        pricingRate.retailMarginPercent,
      ),
      wholesaleAverage: calculateAverageMargin(
        minPurchasePrice,
        maxPurchasePrice,
        pricingRate.wholesaleMarginPercent,
      ),
    });
  }

  return pricingRules;
}

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

    await prisma.permission.upsert({
      where: { code: 'CAN_MARGE' },
      update: {
        label: 'Can manage regulatory margin',
        descriptions: 'Allows access to regulatory margin management features.',
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        label: 'Can manage regulatory margin',
        code: 'CAN_MARGE',
        descriptions: 'Allows access to regulatory margin management features.',
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

    const pricingGrid = await prisma.pricingGrid.upsert({
      where: {
        effectiveFrom: PRICING_GRID_EFFECTIVE_FROM,
      },
      update: {
        status: 'ACTIVE',
        effectiveTo: null,
        createdBy: adminUser.id,
      },
      create: {
        status: 'ACTIVE',
        effectiveFrom: PRICING_GRID_EFFECTIVE_FROM,
        effectiveTo: null,
        createdBy: adminUser.id,
      },
    });

    await prisma.pricingRule.createMany({
      data: buildPricingRuleInputs(pricingGrid.id),
      skipDuplicates: true,
    });
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
