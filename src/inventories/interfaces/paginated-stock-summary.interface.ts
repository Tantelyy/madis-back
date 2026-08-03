import type { StockSummaryEntity } from '../entities/stock-summary.entity';

export interface PaginatedStockSummary {
  data: StockSummaryEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
