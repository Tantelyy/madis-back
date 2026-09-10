import { SupplierEntity } from '../entities/supplier.entity';

export interface PaginatedSuppliers {
  data: SupplierEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
