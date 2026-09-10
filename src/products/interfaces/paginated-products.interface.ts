import { ProductEntity } from '../entities/product.entity';

export interface PaginatedProducts {
  data: ProductEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
