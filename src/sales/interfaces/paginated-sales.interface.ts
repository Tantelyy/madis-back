import { CartEntity } from '../../carts/entities/cart.entity';

export interface PaginatedSales {
  data: CartEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
