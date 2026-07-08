import { InventoryMovementEntity } from '../entities/inventory-movement.entity';

export interface PaginatedInventoryMovements {
  data: InventoryMovementEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
