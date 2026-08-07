import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('uses paid quantities only for revenue and sold cost', async () => {
    const inventoryFindMany = jest.fn().mockReturnValue('inventory-query');
    const cartFindMany = jest.fn().mockReturnValue('cart-query');
    const transaction = jest.fn().mockResolvedValue([
      [
        {
          createdAt: new Date('2026-08-07T05:00:00.000Z'),
          quantity: 3,
          purchasePrice: new Prisma.Decimal(100),
        },
      ],
      [
        {
          createdAt: new Date('2026-08-07T07:00:00.000Z'),
          cartDetails: [
            {
              quantity: 2,
              finalUnitPrice: new Prisma.Decimal(150),
              inventory: { purchasePrice: new Prisma.Decimal(100) },
            },
          ],
        },
      ],
    ]);
    const prisma = {
      inventory: { findMany: inventoryFindMany },
      cart: { findMany: cartFindMany },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    const result = await service.getProfitability({
      from: '2026-08-06T21:00:00.000Z',
      to: '2026-08-07T21:00:00.000Z',
      timezoneOffset: -180,
    });

    expect(result.totals).toEqual({
      purchaseAmount: '300.00',
      revenue: '300.00',
      costOfGoodsSold: '200.00',
      profit: '100.00',
    });
    expect(result.points.map((point) => point.label)).toEqual(['08 h', '10 h']);
  });
});
