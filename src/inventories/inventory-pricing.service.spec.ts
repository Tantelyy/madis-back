import { Prisma } from '@prisma/client';
import { InventoryPricingService } from './inventory-pricing.service';

describe('InventoryPricingService', () => {
  const service = new InventoryPricingService();

  it('preserves CSV prices when both prices are supplied', async () => {
    const tx = {} as Prisma.TransactionClient;

    await expect(
      service.resolveImportedPrices(15600, 16500.5, 16000.25, tx),
    ).resolves.toEqual({
      purchasePrice: '15600.00',
      salePrice: '16500.50',
      wholesalePrice: '16000.25',
    });
  });

  it('calculates each missing CSV sale price from the active margin', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      retailAverage: new Prisma.Decimal(900),
      wholesaleAverage: new Prisma.Decimal(500),
    });
    const tx = {
      pricingRule: { findFirst },
    } as unknown as Prisma.TransactionClient;

    await expect(
      service.resolveImportedPrices(15600, undefined, undefined, tx),
    ).resolves.toEqual({
      purchasePrice: '15600.00',
      salePrice: '16500.00',
      wholesalePrice: '16100.00',
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
