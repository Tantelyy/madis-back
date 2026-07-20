import { SpecialOfferType, SpecialOfferUnit } from '@prisma/client';
import type { CartDetailEntity } from '../../carts/entities/cart-detail.entity';
import type { InventorySpecialOfferEntity } from './inventory-special-offer.entity';

export class SpecialOfferUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class SpecialOfferEntity {
  id!: number;
  label!: string;
  createdAt!: Date;
  createdBy!: number;
  updatedAt!: Date;
  deletedAt!: Date | null;
  deletedBy!: number | null;
  startDateTime!: Date;
  endDateTime!: Date;
  value!: string | null;
  unit!: SpecialOfferUnit | null;
  buyQuantity!: number | null;
  freeQuantity!: number | null;
  type!: SpecialOfferType;
  createdByUser?: SpecialOfferUserEntity;
  deletedByUser?: SpecialOfferUserEntity | null;
  inventorySpecialOffers?: InventorySpecialOfferEntity[];
  cartDetails?: CartDetailEntity[];
}
