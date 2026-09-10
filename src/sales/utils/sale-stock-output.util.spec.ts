import { InventoryMovementType, Prisma } from '@prisma/client';
import { recordSaleStockOutput } from './sale-stock-output.util';

describe('recordSaleStockOutput', () => {
  const values = {
    inventoryId: 12,
    quantity: 1,
    actorId: 3,
    cartId: 8,
    purchasePrice: new Prisma.Decimal(100),
    salePrice: new Prisma.Decimal(140),
    wholesalePrice: new Prisma.Decimal(130),
    createdAt: new Date('2026-04-24T10:11:12.000Z'),
  };

  it('decrements stock atomically and dates the movement with the sale date', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const tx = {
      inventory: { updateMany },
      inventoryMovement: { create },
    } as unknown as Prisma.TransactionClient;

    await recordSaleStockOutput(tx, values);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 12, remainingQuantity: { gte: 1 } },
      data: { remainingQuantity: { decrement: 1 } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        inventoryId: 12,
        incomingQuantity: 0,
        cartId: 8,
        outgoingQuantity: 1,
        actorId: 3,
        createdAt: values.createdAt,
        type: InventoryMovementType.SALE,
        purchasePrice: values.purchasePrice,
        salePrice: values.salePrice,
        wholesalePrice: values.wholesalePrice,
      },
    });
  });

  it('does not create a movement when the stock is insufficient', async () => {
    const create = jest.fn();
    const findUnique = jest.fn().mockResolvedValue({
      remainingQuantity: 0,
      product: { name: 'Produit test' },
    });
    const tx = {
      inventory: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique,
      },
      inventoryMovement: { create },
    } as unknown as Prisma.TransactionClient;

    await expect(recordSaleStockOutput(tx, values)).rejects.toThrow(
      'Le stock disponible est insuffisant pour le produit « Produit test » : 1 unité demandée, 0 unité disponible.',
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: values.inventoryId },
      select: {
        remainingQuantity: true,
        product: { select: { name: true } },
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('records a promotion gift with its dedicated movement type', async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const tx = {
      inventory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      inventoryMovement: { create },
    } as unknown as Prisma.TransactionClient;

    await recordSaleStockOutput(tx, {
      ...values,
      type: InventoryMovementType.PROMOTION_GIFT,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is intentionally dynamic in this assertion.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          type: InventoryMovementType.PROMOTION_GIFT,
        }),
      }),
    );
  });
});
