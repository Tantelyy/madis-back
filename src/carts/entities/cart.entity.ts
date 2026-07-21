import { CartStatus, PaymentMethod } from '@prisma/client';
import type { InventoryMovementEntity } from '../../inventories/entities/inventory-movement.entity';
import type { CartDetailEntity } from './cart-detail.entity';

export class CartUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class CartEntity {
  id!: number;
  soldBy!: number;
  createdAt!: Date;
  updatedAt!: Date;
  status!: CartStatus;
  validatedBy!: number | null;
  totalPrice!: string;
  customerName!: string;
  customerContact!: string;
  customerAddress!: string;
  paymentMethod!: PaymentMethod | null;
  reason!: string | null;
  seller?: CartUserEntity;
  validator?: CartUserEntity | null;
  cartDetails?: CartDetailEntity[];
  inventoryMovements?: InventoryMovementEntity[];
}
