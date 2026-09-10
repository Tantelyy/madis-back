import { InventoryMovementType } from '@prisma/client';
import { InventoryEntity } from './inventory.entity';

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
  cartId!: number | null;
  actor?: {
    id: number;
    userName: string;
    email: string;
  };
  inventory?: InventoryEntity;
}
