import type { InventoryEntity } from '../../inventories/entities/inventory.entity';
import type { SpecialOfferEntity } from './special-offer.entity';

export class InventorySpecialOfferEntity {
  id!: number;
  inventoryId!: number;
  specialOfferId!: number;
  limitDate!: Date | null;
  inventory?: InventoryEntity;
  specialOffer?: SpecialOfferEntity;
}
