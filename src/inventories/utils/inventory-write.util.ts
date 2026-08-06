import { InventoryMovementType, Prisma } from '@prisma/client';

export interface InventoryPriceValues {
  purchasePrice: string;
  salePrice: string;
  wholesalePrice: string;
}

export interface IncomingInventoryValues extends InventoryPriceValues {
  productId: number;
  supplierId: number;
  quantity: number;
  actorId: number;
  createdAt?: Date;
  expiredAt?: Date | null;
}

export function buildIncomingInventoryData(
  values: IncomingInventoryValues,
): Prisma.InventoryUncheckedCreateInput {
  const prices: InventoryPriceValues = {
    purchasePrice: values.purchasePrice,
    salePrice: values.salePrice,
    wholesalePrice: values.wholesalePrice,
  };

  return {
    productId: values.productId,
    quantity: values.quantity,
    remainingQuantity: values.quantity,
    createdBy: values.actorId,
    supplierId: values.supplierId,
    expiredAt: values.expiredAt ?? null,
    createdAt: values.createdAt,
    ...prices,
    inventoryMovements: {
      create: {
        incomingQuantity: values.quantity,
        outgoingQuantity: 0,
        actorId: values.actorId,
        type: InventoryMovementType.INCOMING,
        createdAt: values.createdAt,
        ...prices,
      },
    },
  };
}
