import type { InventoryEntity } from '../../inventories/entities/inventory.entity';
import type { CartEntity } from './cart.entity';

export class CartDetailEntity {
  id!: number;
  cartId!: number;
  inventoryId!: number;
  soldFor!: string;
  quantity!: number;
  wholesale!: boolean;
  specialOfferId!: number | null;
  cart?: CartEntity;
  inventory?: InventoryEntity;
}
