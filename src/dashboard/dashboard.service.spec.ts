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

  it('aggregates paid sales by product and paginates after sorting', async () => {
    const productFindMany = jest.fn().mockReturnValue('product-query');
    const cartDetailGroupBy = jest.fn().mockReturnValue('sales-query');
    const transaction = jest.fn().mockResolvedValue([
      [
        {
          id: 1,
          name: 'Produit A',
          productTypeId: 7,
          productType: { type: 'Alimentaire' },
          inventories: [
            { id: 11, remainingQuantity: 8 },
            { id: 12, remainingQuantity: 4 },
          ],
        },
        {
          id: 2,
          name: 'Produit B',
          productTypeId: 7,
          productType: { type: 'Alimentaire' },
          inventories: [{ id: 21, remainingQuantity: 4 }],
        },
        {
          id: 3,
          name: 'Produit C',
          productTypeId: 7,
          productType: { type: 'Alimentaire' },
          inventories: [{ id: 31, remainingQuantity: 2 }],
        },
      ],
      [
        { inventoryId: 11, _sum: { quantity: 3 } },
        { inventoryId: 12, _sum: { quantity: 2 } },
        { inventoryId: 21, _sum: { quantity: 7 } },
      ],
    ]);
    const prisma = {
      product: { findMany: productFindMany },
      cartDetail: { groupBy: cartDetailGroupBy },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    const result = await service.getSalesStockAnalysis({
      from: '2026-08-03T21:00:00.000Z',
      to: '2026-08-10T21:00:00.000Z',
      timezoneOffset: -180,
      productTypeId: 7,
      page: 1,
      limit: 2,
    });

    expect(result.data).toEqual([
      {
        productId: 2,
        productName: 'Produit B',
        productTypeId: 7,
        productType: 'Alimentaire',
        soldQuantity: 7,
        currentStock: 4,
      },
      {
        productId: 1,
        productName: 'Produit A',
        productTypeId: 7,
        productType: 'Alimentaire',
        soldQuantity: 5,
        currentStock: 12,
      },
    ]);
    expect(result.meta).toEqual({
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
    expect(result.maximumQuantity).toBe(12);
    expect(result.stockAsOf).toEqual(expect.any(String));
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, productTypeId: 7 },
      }),
    );
    expect(cartDetailGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cart: {
            status: 'PAID',
            createdAt: {
              gte: new Date('2026-08-03T21:00:00.000Z'),
              lt: new Date('2026-08-10T21:00:00.000Z'),
            },
          },
          inventory: {
            product: { deletedAt: null, productTypeId: 7 },
          },
        },
      }),
    );
  });
});
