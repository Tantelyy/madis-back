import { InventoryMovementType } from '@prisma/client';
import { buildIncomingInventoryData } from './inventory-write.util';

describe('buildIncomingInventoryData', () => {
  it('copies the import date to the inventory and incoming movement', () => {
    const createdAt = new Date('2026-04-23T00:00:00.000Z');
    const data = buildIncomingInventoryData({
      productId: 1,
      supplierId: 2,
      quantity: 3,
      actorId: 4,
      createdAt,
      purchasePrice: '100.00',
      salePrice: '120.00',
      wholesalePrice: '110.00',
    });

    expect(data.createdAt).toBe(createdAt);
    expect(data.inventoryMovements).toEqual({
      create: {
        incomingQuantity: 3,
        outgoingQuantity: 0,
        actorId: 4,
        type: InventoryMovementType.INCOMING,
        createdAt,
        purchasePrice: '100.00',
        salePrice: '120.00',
        wholesalePrice: '110.00',
      },
    });
  });
});
