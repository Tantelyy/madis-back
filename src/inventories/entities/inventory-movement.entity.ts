import { InventoryMovementType } from '@prisma/client';

export class InventoryMovementEntity {
  id!: number;
  inventoryId!: number;
  incomingQuantity!: number;
  outgoingQuantity!: number;
  actorId!: number;
  createdAt!: Date;
  updatedAt!: Date;
  purchasePrice!: string;
  salePrice!: string;
  type!: InventoryMovementType;
  wholesalePrice!: string;
}
