import type { InventoryEntity } from '../../inventories/entities/inventory.entity';
import type { SpecialOfferEntity } from '../../special-offers/entities/special-offer.entity';
import type { CartEntity } from './cart.entity';

export class CartDetailEntity {
  id!: number;
  cartId!: number;
  inventoryId!: number;
  quantity!: number;
  freeQuantity!: number | null;
  baseUnitPrice!: string;
  finalUnitPrice!: string;
  discountAmount!: string | null;
  wholesale!: boolean;
  specialOfferId!: number | null;
  cart?: CartEntity;
  inventory?: InventoryEntity;
  specialOffer?: SpecialOfferEntity | null;
}
