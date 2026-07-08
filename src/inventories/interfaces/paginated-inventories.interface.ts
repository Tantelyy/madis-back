import { InventoryEntity } from '../entities/inventory.entity';

export interface PaginatedInventories {
  data: InventoryEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
