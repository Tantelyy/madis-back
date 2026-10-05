import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('uses net paid quantities for profitability', async () => {
    const prisma = {
      inventory: { findMany: jest.fn().mockReturnValue('inventories') },
      cart: { findMany: jest.fn().mockReturnValue('sales') },
      $transaction: jest.fn().mockResolvedValue([
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
                refundedQuantity: 1,
                finalUnitPrice: new Prisma.Decimal(150),
                inventory: { purchasePrice: new Prisma.Decimal(100) },
              },
            ],
          },
        ],
      ]),
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    const result = await service.getProfitability({
      from: '2026-08-06T21:00:00.000Z',
      to: '2026-08-07T21:00:00.000Z',
      timezoneOffset: -180,
    });

    expect(result.totals).toEqual({
      purchaseAmount: '300.00',
      revenue: '150.00',
      costOfGoodsSold: '100.00',
      profit: '50.00',
    });
  });

  it('paginates the current sales-stock analysis after sorting', async () => {
    const prisma = {
      product: { findMany: jest.fn().mockReturnValue('products') },
      cartDetail: { findMany: jest.fn().mockReturnValue('sales') },
      $transaction: jest.fn().mockResolvedValue([
        [
          {
            id: 1,
            name: 'Produit A',
            productTypeId: 7,
            productType: { type: 'Alimentaire' },
            inventories: [{ id: 11, remainingQuantity: 8 }],
          },
          {
            id: 2,
            name: 'Produit B',
            productTypeId: 7,
            productType: { type: 'Alimentaire' },
            inventories: [{ id: 21, remainingQuantity: 4 }],
          },
        ],
        [
          { inventoryId: 11, quantity: 3, refundedQuantity: 1 },
          { inventoryId: 21, quantity: 7, refundedQuantity: 0 },
        ],
      ]),
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    const result = await service.getSalesStockAnalysis({
      from: '2026-08-03T21:00:00.000Z',
      to: '2026-08-10T21:00:00.000Z',
      timezoneOffset: -180,
      page: 1,
      limit: 1,
    });

    expect(result.data).toEqual([
      expect.objectContaining({ productId: 2, soldQuantity: 7 }),
    ]);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 1, totalPages: 2 });
  });

  it('excludes expired lots from current stock while preserving their sales history', async () => {
    const prisma = {
      product: { findMany: jest.fn().mockReturnValue('products') },
      cartDetail: { findMany: jest.fn().mockReturnValue('sales') },
      $transaction: jest.fn().mockResolvedValue([
        [
          {
            id: 12,
            name: 'Produit test',
            productTypeId: 4,
            productType: { type: 'Hygiène' },
            inventories: [
              { id: 1, remainingQuantity: 81, expiredAt: null },
              {
                id: 2,
                remainingQuantity: 5,
                expiredAt: new Date('2020-01-01'),
              },
            ],
          },
        ],
        [{ inventoryId: 2, quantity: 5, refundedQuantity: 0 }],
      ]),
    } as unknown as PrismaService;

    const result = await new DashboardService(prisma).getSalesStockAnalysis({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      timezoneOffset: -180,
      page: 1,
      limit: 10,
    });

    expect(result.data[0]).toMatchObject({ currentStock: 81, soldQuantity: 5 });
  });

  it('requests and maps a forecast for one product only', async () => {
    const productFindFirst = jest.fn().mockResolvedValue({
      id: 12,
      name: 'Produit test',
      reference: 'TEST-12',
      productTypeId: 4,
      productType: { type: 'Hygiène' },
    });
    const prisma = {
      product: { findFirst: productFindFirst },
    } as unknown as PrismaService;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          forecasts: [
            {
              productId: 12,
              asOfDate: '2026-08-28',
              forecastDays: 7,
              currentStock: 25,
              totalPredictedDemand: 10,
              alreadyOutOfStock: false,
              stockoutExpected: false,
              predictedStockoutDate: null,
              daysUntilStockout: null,
              remainingStockAfterHorizon: 15,
            },
          ],
        }),
    } as Response);
    const service = new DashboardService(prisma);

    const result = await service.getProductForecast(12);

    expect(result).toEqual({
      productId: 12,
      productName: 'Produit test',
      productReference: 'TEST-12',
      productTypeId: 4,
      productType: 'Hygiène',
      asOfDate: '2026-08-28',
      forecastDays: 7,
      currentStock: 25,
      totalPredictedDemand: 10,
      remainingStockAfterHorizon: 15,
      status: 'SUFFICIENT_STOCK',
      predictedStockoutDate: null,
      daysUntilStockout: null,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/stockout/forecast',
      expect.objectContaining({
        body: JSON.stringify({ productIds: [12], days: 7 }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('rejects a forecast request for a missing product', async () => {
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    await expect(service.getProductForecast(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reads a fresh forecast after stock changes', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 12,
          name: 'Produit test',
          reference: 'TEST-12',
          productTypeId: 4,
          productType: { type: 'Hygiène' },
        }),
      },
    } as unknown as PrismaService;
    const forecast = (currentStock: number) => ({
      productId: 12,
      asOfDate: '2026-10-05',
      forecastDays: 7,
      currentStock,
      totalPredictedDemand: 10,
      alreadyOutOfStock: false,
      stockoutExpected: false,
      predictedStockoutDate: null,
      daysUntilStockout: null,
      remainingStockAfterHorizon: currentStock - 10,
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ forecasts: [forecast(86)] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ forecasts: [forecast(81)] }),
      } as Response);
    try {
      const service = new DashboardService(prisma);
      expect((await service.getProductForecast(12)).currentStock).toBe(86);
      expect((await service.getProductForecast(12)).currentStock).toBe(81);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
