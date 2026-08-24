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
  refundAt!: Date | null;
  refundBy!: number | null;
  refundedQuantity!: number;
  reason!: string | null;
  product?: CartDetailProductEntity;
  refundUser?: CartDetailRefundUserEntity | null;
  cart?: CartEntity;
  inventory?: InventoryEntity;
  specialOffer?: SpecialOfferEntity | null;
}

export class CartDetailRefundUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class CartDetailProductEntity {
  id!: number;
  name!: string;
  reference!: string;
  image!: string | null;
}
