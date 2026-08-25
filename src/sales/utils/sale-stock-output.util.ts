import { ConflictException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { buildInsufficientStockMessage } from './stock-message.util';

export interface SaleStockOutputValues {
  inventoryId: number;
  quantity: number;
  actorId: number;
  cartId: number;
  purchasePrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  wholesalePrice: Prisma.Decimal;
  type?: InventoryMovementType;
  createdAt?: Date;
}

export async function recordSaleStockOutput(
  tx: Prisma.TransactionClient,
  values: SaleStockOutputValues,
): Promise<void> {
  const updated = await tx.inventory.updateMany({
    where: {
      id: values.inventoryId,
      remainingQuantity: { gte: values.quantity },
    },
    data: {
      remainingQuantity: { decrement: values.quantity },
    },
  });

  if (updated.count === 0) {
    const inventory = await tx.inventory.findUnique({
      where: { id: values.inventoryId },
      select: {
        remainingQuantity: true,
        product: { select: { name: true } },
      },
    });

    throw new ConflictException(
      buildInsufficientStockMessage(
        inventory?.product.name ?? `n°${values.inventoryId}`,
        values.quantity,
        inventory?.remainingQuantity ?? 0,
      ),
    );
  }

  await tx.inventoryMovement.create({
    data: {
      inventoryId: values.inventoryId,
      incomingQuantity: 0,
      outgoingQuantity: values.quantity,
      actorId: values.actorId,
      type: values.type ?? InventoryMovementType.SALE,
      purchasePrice: values.purchasePrice,
      salePrice: values.salePrice,
      wholesalePrice: values.wholesalePrice,
      cartId: values.cartId,
      ...(values.createdAt ? { createdAt: values.createdAt } : {}),
    },
  });
}
