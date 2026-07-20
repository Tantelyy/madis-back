import { ProductEntity } from '../../products/entities/product.entity';
import type { InventorySpecialOfferEntity } from '../../special-offers/entities/inventory-special-offer.entity';
import { SupplierEntity } from '../../suppliers/entities/supplier.entity';

export class InventoryUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class InventoryEntity {
  id!: number;
  productId!: number;
  quantity!: number;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: number;
  purchasePrice!: string;
  salePrice!: string;
  updatedBy!: number | null;
  supplierId!: number;
  wholesalePrice!: string;
  remainingQuantity!: number;
  expiredAt!: Date | null;
  product?: ProductEntity;
  supplier?: SupplierEntity;
  createdByUser?: InventoryUserEntity;
  updatedByUser?: InventoryUserEntity | null;
  inventorySpecialOffers?: InventorySpecialOfferEntity[];
}
