import { SaleCatalogProductEntity } from '../entities/sale-catalog-product.entity';

export interface PaginatedSaleCatalog {
  data: SaleCatalogProductEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
